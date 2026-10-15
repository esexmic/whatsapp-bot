import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from '@whiskeysockets/baileys'

import P from 'pino'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { fileURLToPath } from 'url'
import { execFile } from 'child_process'
import { promisify } from 'util'
import http from 'http'
import qrcode from 'qrcode'
import { printQR, removeQR } from './lib/qr.js'

import { env, envBool, envInt } from './config/env.js'
import { isBanned, isOwner, isAdmin, clean, registerLidMapping, getSenderId } from './lib/perms.js'
import { serialize } from './lib/serialize.js'
import { loadDB, saveDB, flushDB, defaultDB, SESSION_DIR } from './lib/store.js'
import { resolveVersion } from './lib/baileys-version.js'
import { cacheContact } from './lib/contacts.js'

const execFileAsync = promisify(execFile)

const PORT = envInt('PORT', 3000)
const LOG_LEVEL = env('LOG_LEVEL', 'error')
const railwayDomain = env('RAILWAY_PUBLIC_DOMAIN').replace(/^https?:\/\//, '').replace(/\/+$/, '')
const QR_BASE_URL = railwayDomain ? `https://${railwayDomain}` : `http://localhost:${PORT}`

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─────────────────────────────────────────────
// Estado global
// ─────────────────────────────────────────────
global.db = defaultDB()
global._startTime = Date.now()
global._extraOwners = global.db.data.extraOwners || []
global._msgLog = {}
global._msgStore = {}
global._snipes = {}
global._spamCount = {}
global._disabledCmds = new Map()
global._commands = {}
global._validCommands = new Set()

let conn = null
let reconnectAttempts = 0
let reconnectTimer = null
let stopping = false
let saveCredsRef = null
let activeQR = null
let activeQRToken = null

// ─────────────────────────────────────────────
// Healthcheck HTTP (scope de módulo: no se duplica al reconectar)
// ─────────────────────────────────────────────
const healthServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url.startsWith('/qr/')) {
    if (!activeQR || !activeQRToken || req.url !== `/qr/${activeQRToken}`) {
      res.writeHead(410, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
      res.end('Este QR ya venció. Abre el enlace más reciente de los logs.')
      return
    }

    qrcode.toBuffer(activeQR, { width: 600, margin: 2 })
      .then((image) => {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        })
        res.end(image)
      })
      .catch((err) => {
        console.error('[qr] no se pudo generar la imagen:', err.message)
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
        res.end('No se pudo generar el QR')
      })
    return
  }

  const connected = Boolean(global._connected)
  res.writeHead(connected ? 200 : 503, { 'Content-Type': 'text/plain' })
  res.end(connected ? 'OK' : 'STARTING')
})

healthServer.on('error', (err) => {
  console.error(`[health] no se pudo abrir el puerto ${PORT}: ${err.message}`)
  if (err.code === 'EADDRINUSE') {
    console.error('[health] el puerto ya está en uso, el bot sigue corriendo sin healthcheck')
  }
})

healthServer.requestTimeout = 10000
healthServer.headersTimeout = 12000
healthServer.listen(PORT)

function clearSpamIntervals() {
  if (global._spamIntervals) {
    for (const t of global._spamIntervals.values()) clearInterval(t)
    global._spamIntervals.clear()
  }
}

/** Borra las credenciales de WhatsApp para forzar un QR nuevo. */
function clearSession() {
  try {
    if (!fs.existsSync(SESSION_DIR)) return
    for (const f of fs.readdirSync(SESSION_DIR)) {
      fs.rmSync(path.join(SESSION_DIR, f), { recursive: true, force: true })
    }
    console.log('🗑️  Sesión anterior eliminada. Se generará un QR nuevo.')
  } catch (e) {
    console.error('No se pudieron limpiar las sesiones:', e.message)
  }
}

// ─────────────────────────────────────────────
// Carga de comandos (una sola vez, fuera de startBot)
// ─────────────────────────────────────────────
async function loadCommands() {
  const cmdsDir = path.join(__dirname, 'commands')
  const files = fs.readdirSync(cmdsDir).filter((f) => f.endsWith('.js'))

  for (const f of files) {
    const name = f.replace(/\.js$/, '')
    global._validCommands.add(name)
    try {
      const mod = await import(`./commands/${f}`)
      if (typeof mod?.default === 'function') {
        global._commands[name] = mod.default
      } else {
        console.warn(`[load] ${f} no exporta una función por defecto`)
      }
    } catch (err) {
      console.error(`[load] fallo al cargar ${f}: ${err.message}`)
    }
  }

  console.log(`✅ ${global._validCommands.size} comandos cargados`)
}

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────
const normalizedId = (jid) => {
  if (!jid) return ''
  const raw = String(jid)
  if (raw.endsWith('@g.us')) return raw
  if (raw.endsWith('@lid')) return raw
  return raw.split('@')[0].split(':')[0] + '@s.whatsapp.net'
}

function getMessageText(msg) {
  const m = msg.message
  if (!m) return ''
  if (m.conversation) return m.conversation
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text
  if (m.imageMessage?.caption) return m.imageMessage.caption
  if (m.videoMessage?.caption) return m.videoMessage.caption
  if (m.documentMessage?.caption) return m.documentMessage.caption
  if (m.documentWithCaptionMessage?.message?.documentMessage?.caption)
    return m.documentWithCaptionMessage.message.documentMessage.caption
  if (m.buttonsResponseMessage?.selectedButtonId)
    return m.buttonsResponseMessage.selectedButtonId
  if (m.listResponseMessage?.singleSelectReply?.selectedRowId)
    return m.listResponseMessage.singleSelectReply.selectedRowId
  if (m.audioMessage) return '🎵 Audio'
  if (m.stickerMessage) return '🎨 Sticker'
  if (m.contactMessage) return '👤 Contacto'
  if (m.locationMessage) return '📍 Ubicación'
  if (m.viewOnceMessage) return '👁️ Una vez'
  return '*Sin texto*'
}

// ─────────────────────────────────────────────
// Arranque
// ─────────────────────────────────────────────
async function startBot() {
  if (stopping) return

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  saveCredsRef = saveCreds
  const version = await resolveVersion()

  // Si hay credenciales previas, no debería pedir QR. Esto avisa si la sesión
  // no se está reutilizando, que es la causa de "me pide login cada vez".
  const hasSession = Boolean(state?.creds?.registered)
  if (!reconnectAttempts) {
    console.log(hasSession ? '🔑 Sesión guardada encontrada. Conectando...' : '🆕 Sin sesión: se pedirá QR.')
  }

  const socket = makeWASocket({
    version,
    auth: state,
    logger: P({ level: LOG_LEVEL }),
    browser: ['Chrome', 'Edge', '120.0.0.0'],
    markOnlineOnConnect: true,
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    defaultQueryTimeoutMs: 60000,
    retryRequestDelayMs: 500,
    maxMsgRetryCount: 5,
    enableAutoSessionRecreation: true,
  })

  conn = socket

// Baileys NO expone `conn.contacts`. Muchos comandos lo usan, así que se crea
// la cache aquí y se espeja hacia global.db.contacts. Antes esto reventaba con
// "Cannot set properties of undefined" con cada contacto nuevo.
socket.contacts = {}
for (const [jid, name] of Object.entries(global.db.contacts)) {
    if (typeof name === 'string') socket.contacts[jid] = { id: jid, notify: name, name }
  }

  // saveCreds escribe creds.json de forma asíncrona: si falla en silencio, el
// bot funciona pero no guarda sesión y pide QR en cada arranque.
socket.ev.on('creds.update', async () => {
  try {
    await saveCreds()
  } catch (e) {
    console.error('[session] no se pudieron guardar las credenciales:', e.message)
  }
})

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && qr !== activeQR) {
      activeQR = qr
      activeQRToken = randomBytes(24).toString('hex')
      printQR(qr, {
        terminal: false,
        imageUrl: `${QR_BASE_URL}/qr/${activeQRToken}`,
      })
    }

    if (connection === 'open') {
      global._connected = true
      activeQR = null
      activeQRToken = null
      reconnectAttempts = 0
      console.log('✅ Bot conectado correctamente')
      global._startTime = Date.now()
      removeQR()

      if (envBool('AUTO_UPDATE_YTDLP', false)) {
        execFileAsync('yt-dlp', ['-U'], { timeout: 60000 })
          .then(() => console.log('✅ yt-dlp actualizado'))
          .catch((e) => console.warn('⚠️ no se pudo actualizar yt-dlp:', e.message))
      }
    }

    if (connection === 'close') {
      global._connected = false
      const code = lastDisconnect?.error?.output?.statusCode
      const reason = lastDisconnect?.error?.message || ''
      console.log(`❌ Conexión cerrada (code: ${code}): ${reason}`)

      clearSpamIntervals()
      try {
        socket.end(undefined, true)
      } catch {}

if (stopping) return

      // El QR es de un solo uso: hay que permitir mostrar el siguiente.
      // Sin esto, tras un 515 reconecta en silencio y nunca ves el QR nuevo.
      activeQR = null
      activeQRToken = null
      removeQR()

      // 401 = WhatsApp revocó la sesión. Ahí sí no hay nada que reconectar.
      if (code === DisconnectReason.loggedOut) {
        console.log('🔑 WhatsApp cerró esta sesión (401). Vuelve a escanear el QR.')
        if (envBool('AUTO_RESET_SESSION', true)) clearSession()
        flushDB()
        process.exit(1)
      }

      // 403 = baneo real. Reinsistir lo empeora.
      if (code === DisconnectReason.forbidden) {
        console.error('🚫 Cuenta baneada por WhatsApp (403). No se reintentará.')
        flushDB()
        process.exit(1)
      }

      // 500 = credenciales corruptas. Regenera la sesión desde cero.
      if (code === DisconnectReason.badSession) {
        console.log('⚠️ Sesión corrupta (500). Regenerando credenciales...')
        if (envBool('AUTO_RESET_SESSION', true)) clearSession()
      }

      // 515 = restartRequired. Es lo NORMAL al cambiar algo en el socket:
      // se reconecta con backoff, no se muere.
      if (code === DisconnectReason.restartRequired) {
        console.log('♻️ WhatsApp pidió reinicio (515). Reconectando...')
      }

      // Muchos reintentos NO significan sesión inválida: casi siempre es red o
      // caída de WhatsApp. Borrar las credenciales aquí es lo que hacía que el
      // bot pidiera QR otra vez al reiniciar. Se espera y ya está.
      if (reconnectAttempts >= 12) {
        console.error(
          `⚠️ ${reconnectAttempts} reintentos sin conectar. Las credenciales se conservan.\n` +
            `   Revisa tu internet. La sesión sigue guardada; no hace falta QR.`
        )
        reconnectAttempts = 0
      }

      // Backoff exponencial con jitter, tope de 2 minutos.
      const delay = Math.min(4000 * 2 ** Math.min(reconnectAttempts, 5), 120000)
      const jitter = Math.floor(Math.random() * 2000)
      reconnectAttempts++
      console.log(`♻️ Reconectando en ${Math.round((delay + jitter) / 1000)}s...`)

      reconnectTimer = setTimeout(() => {
        startBot().catch((err) => {
          console.error('❌ Error al reconectar:', err.message)
          reconnectTimer = setTimeout(startBot, 10000)
        })
      }, delay + jitter)
    }
  })

  // WhatsApp manda cada persona con dos ids (numero y @lid). Sin guardar esta
  // equivalencia, un owner identificado por @lid fallaba en cada comando de
  // owner aunque .roles lo mostrara como tal.
  socket.ev.on('lid-mapping.update', ({ lid, pn } = {}) => {
    registerLidMapping(lid, pn)
  })

  socket.ev.on('contacts.upsert', (contacts) => {
    let changed = false
    for (const c of contacts) {
      if (c?.lid && c?.pn) registerLidMapping(c.lid, c.pn)
      if (!c.id) continue
      const name = c.notify || c.name || c.pushName
      if (name && cacheContact(socket, normalizedId(c.id), name)) changed = true
    }
    if (changed) saveDB()
  })

  // ── Bienvenidas y despedidas ──
  socket.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (!id?.endsWith?.('@g.us')) return

    const template =
      action === 'add'
        ? global.db.config?.welcome?.[id]
        : action === 'remove'
          ? global.db.config?.goodbye?.[id]
          : null

    if (!template) return

    for (const p of participants) {
      const jid = typeof p === 'string' ? p : p?.jid || ''
      if (!jid) continue
      const text = template.replace(/@user/g, `@${jid.split('@')[0]}`)
      await socket.sendMessage(id, { text, mentions: [jid] }).catch(() => {})
    }
  })

  // ── Mensajes borrados (.snipe) ──
  socket.ev.on('messages.update', (updates) => {
    for (const { key, update } of updates) {
      if (update?.messageStubType !== 25 || !key?.id || !key?.remoteJid) continue
      const chat = key.remoteJid
      if (!chat.endsWith('@g.us')) continue

      let foundId = key.id
      if (!global._msgStore[foundId]) {
        const deletedUser = normalizedId(key.participant)
        if (!deletedUser) continue
        let ts = 0
        foundId = null
        for (const [id, msg] of Object.entries(global._msgStore)) {
          if (msg.chat === chat && msg.sender === deletedUser && (msg.timestamp || 0) >= ts) {
            foundId = id
            ts = msg.timestamp || 0
          }
        }
      }

      if (!foundId) continue
      if (!global._snipes[chat]) global._snipes[chat] = []
      global._snipes[chat].unshift(global._msgStore[foundId])
      if (global._snipes[chat].length > 5) global._snipes[chat].pop()
      delete global._msgStore[foundId]
    }
  })

  const processedIds = new Set()

  // ── Mensajes ──
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    // Antes solo se procesaba messages[0]: el resto se perdía y esquivaba
    // mute / antilink / antispam / antivirgenes.
    for (const raw of messages) {
      try {
        await handleMessage(socket, raw, processedIds)
      } catch (err) {
        console.error('[handler] error:', err.message)
      }
    }
  })
}

// ─────────────────────────────────────────────
// Handler de un mensaje
// ─────────────────────────────────────────────
async function handleMessage(socket, raw, processedIds) {
  const m = serialize(raw)
  if (!m?.key?.remoteJid || m.key.fromMe) return

  const msgId = m.key.id
  if (processedIds.has(msgId)) return
  processedIds.add(msgId)
  // Evict FIFO en vez de clear(): si no, los IDs recientes podían reprocesarse.
  while (processedIds.size > 1000) processedIds.delete(processedIds.values().next().value)

  const chat = m.key.remoteJid
  const isGroup = chat.endsWith('@g.us')
  const sender = normalizedId(m.key.participant || m.key.remoteJid)

  // El id con el que se guarda estado (ban, AFK, mute, owners). Puede venir
  // como @lid si WhatsApp manda la conversacion en modo lid: se usa el numero
  // real del campo alterno para que mute/ban/AFK no se esquiven.
  const senderId = getSenderId(m)
  const botJid = normalizedId(socket.user?.id || '')

  // --- Revocados ---
  if (m.message?.protocolMessage?.type === 0) {
    const origKey = m.message.protocolMessage.key
    if (origKey?.remoteJid?.endsWith?.('@g.us') && global._msgStore[origKey.id]) {
      pushSnipe(origKey.remoteJid, global._msgStore[origKey.id])
      delete global._msgStore[origKey.id]
    }
    return
  }

  if (m.messageStubType === 25) {
    if (isGroup) {
      if (global._msgStore[msgId]) {
        pushSnipe(chat, global._msgStore[msgId])
        delete global._msgStore[msgId]
      } else {
        const params = m.messageStubParameters || []
        const deletedUser = params.length > 0 ? normalizedId(params[0]) : null
        if (deletedUser) {
          let foundId = null
          let ts = 0
          for (const [id, msg] of Object.entries(global._msgStore)) {
            if (msg.chat === chat && msg.sender === deletedUser && (msg.timestamp || 0) >= ts) {
              foundId = id
              ts = msg.timestamp || 0
            }
          }
          if (foundId) {
            pushSnipe(chat, global._msgStore[foundId])
            delete global._msgStore[foundId]
          }
        }
      }
    }
    return
  }

  if (!m.message) return
  if (sender === botJid) return

  // --- Contactos (cache de nombres) ---
  if (raw.pushName && cacheContact(socket, sender, raw.pushName)) {
    saveDB()
  }

  // --- Track para .pg ---
  if (msgId) {
    if (!global._msgLog[chat]) global._msgLog[chat] = {}
    if (!global._msgLog[chat][sender]) global._msgLog[chat][sender] = []
    const log = global._msgLog[chat][sender]
    log.push({ id: msgId, participant: m.key.participant, fromMe: m.key.fromMe })
    if (log.length > 20) log.splice(0, log.length - 20)
  }

  // --- Track para .snipe ---
  global._msgStore[msgId] = {
    content: getMessageText(m),
    sender,
    chat,
    timestamp: m.messageTimestamp || Date.now(),
    imageMessage: m.message?.imageMessage || null,
    videoMessage: m.message?.videoMessage || null,
  }
  const storeKeys = Object.keys(global._msgStore)
  if (storeKeys.length > 1000) {
    for (const k of storeKeys.slice(0, 500)) delete global._msgStore[k]
  }

  // --- Mute ---
  if (isGroup && global.db.data.muted.includes(senderId)) {
    await socket
      .sendMessage(chat, {
        delete: { remoteJid: chat, fromMe: false, id: msgId, participant: m.key.participant },
      })
      .catch(() => {})
    return
  }

  // --- Banned ---
  if (isBanned(senderId, global.db)) return

  // --- Antilink ---
  if (isGroup && global.db.config.antilink.includes(chat)) {
    const txt = m.text || ''
    if (/https?:\/\/(?!chat\.whatsapp\.com)[^\s]+/i.test(txt)) {
      await socket
        .sendMessage(chat, {
          delete: { remoteJid: chat, fromMe: false, id: msgId, participant: m.key.participant },
        })
        .catch(() => {})
    }
  }

  // --- Antispam ---
  if (isGroup && global.db.config.antispam.includes(chat)) {
    if (!global._spamCount[senderId]) global._spamCount[senderId] = []
    const now = Date.now()
    global._spamCount[senderId] = global._spamCount[senderId].filter((t) => now - t < 5000)
    global._spamCount[senderId].push(now)
    if (global._spamCount[senderId].length > 5) {
      await socket
        .sendMessage(chat, {
          delete: { remoteJid: chat, fromMe: false, id: msgId, participant: m.key.participant },
        })
        .catch(() => {})
    }
  }

  // --- AFK: el usuario vuelve ---
  if (isGroup && global.db.data.afk[senderId]) {
    const afkData = global.db.data.afk[senderId]
    delete global.db.data.afk[senderId]
    saveDB()
    const elapsed = Math.floor((Date.now() - afkData.since) / 1000)
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
    await socket
      .sendMessage(chat, { text: `✨ Bienvenido de vuelta!\n\nEstuviste AFK durante ${timeStr}` }, { quoted: m })
      .catch(() => {})
  }

  // --- AFK: mencionado ---
  if (isGroup && m.mentionedJid?.length) {
    for (const mentioned of m.mentionedJid) {
      const afkData = global.db.data.afk[normalizedId(mentioned)]
      if (!afkData) continue
      const elapsed = Math.floor((Date.now() - afkData.since) / 1000)
      const mins = Math.floor(elapsed / 60)
      const secs = elapsed % 60
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
      await socket
        .sendMessage(
          chat,
          {
            text: `⏰ *${afkData.name}* está AFK desde hace ${timeStr}\n\n📝 Motivo: ${afkData.reason || 'Sin motivo'}`,
          },
          { quoted: m }
        )
        .catch(() => {})
      break
    }
  }

  // --- Antivirgenes ---
  if (
    isGroup &&
    global.db.data.antivirgenes.includes(chat) &&
    (m.message?.contactMessage || m.message?.contactsArrayMessage)
  ) {
    await socket
      .sendMessage(chat, {
        delete: { remoteJid: chat, fromMe: false, id: msgId, participant: m.key.participant },
      })
      .catch(() => {})
    await socket.groupParticipantsUpdate(chat, [sender], 'remove').catch(() => {})
    return
  }

  // --- Autoresponder ---
  if (isGroup) {
    const ar = global.db.data.autoresponder || {}
    const triggers = { ...(ar.global || {}), ...(ar[chat] || {}) }
    const haystack = (m.text || '').toLowerCase()
    for (const [trigger, response] of Object.entries(triggers)) {
      if (!trigger || trigger.length < 3) continue
      if (haystack.includes(trigger.toLowerCase())) {
        await socket.sendMessage(chat, { text: response }, { quoted: m }).catch(() => {})
        break
      }
    }
  }

  // --- Menciones al bot ---
  if (m.mentionedJid?.some((j) => normalizedId(j) === botJid)) {
    const text = m.text || ''
    if (!/^[.!]/.test(text.trim()) && !/^xyb\b/i.test(text.trim())) {
      await socket
        .sendMessage(chat, { text: 'no estes chingando puta' }, { quoted: m })
        .catch(() => {})
    }
  }

  // --- Modo privado: solo owners/admins ---
  if (global.db.config.mode === 'private' && !isOwner(senderId) && !isAdmin(senderId, global.db)) {
    return
  }

  // ─────────────────────────────────────────────
  // Dispatch de comandos
  // ─────────────────────────────────────────────
  const text = m.text || ''
  if (!text.trim()) return

  const trimmed = text.trim()
  const args = trimmed.split(/\s+/)
  let rawCmd = args[0].toLowerCase()
  let cmdArgs = args.slice(1)

  if (rawCmd === 'xyb' && args.length > 1) {
    rawCmd = args[1].toLowerCase()
    cmdArgs = args.slice(2)
  }

  const commandName = rawCmd.replace(/^[.!]/, '')

  const alias = { s: 'sticker', n: 'notify' }
  const target = alias[commandName] || commandName

  if (!global._validCommands.has(target)) return

  if (target !== 'cmdoff' && target !== 'cmdon' && global._disabledCmds.has(target)) {
    const ownerWhoDisabled = global._disabledCmds.get(target)
    const ownerName =
      global.db.contacts?.[normalizedId(ownerWhoDisabled)] ||
      String(ownerWhoDisabled || '').split('@')[0] ||
      'owner'
    await socket
      .sendMessage(chat, { text: `"${target}" está desactivado por ${ownerName}` }, { quoted: m })
      .catch(() => {})
    return
  }

  const cmd = global._commands[target]
  if (!cmd) return

  try {
    await cmd(socket, m, cmdArgs, global.db, chat)
  } catch (err) {
    console.error(`[cmd:${target}]`, err.message)
  }
}

function pushSnipe(chat, entry) {
  if (!entry) return
  if (!global._snipes[chat]) global._snipes[chat] = []
  global._snipes[chat].unshift(entry)
  if (global._snipes[chat].length > 5) global._snipes[chat].pop()
}

// ─────────────────────────────────────────────
// QR
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Apagado ordenado
// ─────────────────────────────────────────────
async function shutdown(signal) {
  if (stopping) return
  stopping = true
  console.log(`\n👋 ${signal} recibido, cerrando...`)
  clearSpamIntervals()
  if (reconnectTimer) clearTimeout(reconnectTimer)
  try {
    flushDB()
  } catch {}

  // Guarda las credenciales antes de morir: si no, se pierde la sesión y
  // el siguiente arranque vuelve a pedir QR.
  try {
    if (saveCredsRef) await saveCredsRef()
  } catch (e) {
    console.error('[session] error al guardar credenciales al salir:', e.message)
  }

  try {
    conn?.end(undefined, true)
  } catch {}

  // Margen para que terminen las escrituras pendientes.
  setTimeout(() => {
    healthServer.close()
    process.exit(0)
  }, 500)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason?.message || reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message)
  console.error(err.stack)
})

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
global.saveDB = saveDB

loadDB(global.db)
global._extraOwners = global.db.data.extraOwners || []

await loadCommands()

console.log('🚀 Iniciando bot...')
startBot().catch((err) => {
  console.error('💥 Error fatal al iniciar:', err.message)
  console.error(err.stack)
  process.exit(1)
})