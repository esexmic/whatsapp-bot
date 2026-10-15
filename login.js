import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from '@whiskeysockets/baileys'
import P from 'pino'
import fs from 'fs'
import path from 'path'
import { printQR, removeQR } from './src/lib/qr.js'
import { SESSION_DIR } from './src/lib/store.js'
import { resolveVersion } from './src/lib/baileys-version.js'
import { env } from './src/config/env.js'

const DELETE_OLD = envBoolDefault('DELETE_OLD_SESSIONS', true)
const MAX_ATTEMPTS = 40

function envBoolDefault(key, fallback) {
  const v = process.env[key]
  if (v === undefined || v === '') return fallback
  return /^(1|true|yes|on)$/i.test(String(v).trim())
}

console.log('🚀 Login local - genera un QR nuevo')
console.log('   Escanéalo antes de que caduque (suele durar ~30s).')
console.log('   Si se cierra la conexión, se genera otro solo.\n')

if (DELETE_OLD && fs.existsSync(SESSION_DIR)) {
  for (const f of fs.readdirSync(SESSION_DIR)) {
    fs.rmSync(path.join(SESSION_DIR, f), { recursive: true, force: true })
  }
  console.log('🗑️ Sessions viejas eliminadas\n')
}

let attempts = 0
let qrTimer = null
let stopping = false

/** El QR caduca ~30s: si no lo escaneas, avisa y pide uno nuevo. */
function armQRTimer() {
  clearTimeout(qrTimer)
  qrTimer = setTimeout(() => {
    console.log('\n⏰ El QR caducó sin ser escaneado. Pide uno nuevo con Ctrl+C y npm run login.\n')
  }, 30000)
  qrTimer.unref?.()
}

function attempt() {
  if (stopping) return

  attempts++
  qrPrinted = false

  ;(async () => {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
      const version = await resolveVersion()

      const conn = makeWASocket({
        version,
        auth: state,
        logger: P({ level: env('LOG_LEVEL', 'warn') }),
        browser: ['Chrome', 'Edge', '120.0.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: 60000,
      })

      conn.ev.on('creds.update', saveCreds)

      conn.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update

        if (qr && !qrPrinted) {
          qrPrinted = true
          printQR(qr)
          armQRTimer()
        }

        if (connection === 'open') {
          clearTimeout(qrTimer)

          // saveCreds escribe creds.json de forma asíncrona. Si el proceso
          // muere antes, el archivo se pierde y el siguiente arranque vuelve a
          // pedir QR. Por eso se fuerza el guardado y se espera a que termine.
          try {
            await saveCreds()
          } catch (e) {
            console.error('⚠️ No pude guardar las credenciales:', e.message)
          }

          console.log('\n✅ Conectado. Sesión guardada en sessions/')
          try {
            console.log(`   creds.json: ${fs.existsSync(path.join(SESSION_DIR, 'creds.json')) ? 'guardado ✅' : 'NO SE GUARDÓ ❌'}`)
          } catch {}
          console.log('📁 Ya puedes arrancar el bot con: npm start')

          removeQR()
          stopping = true
          try {
            conn.end(undefined, true)
          } catch {}

          // Margen para que termine cualquier escritura pendiente.
          setTimeout(() => process.exit(0), 500)
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode
          const msg = lastDisconnect?.error?.message || ''

          // 401 = sesión revocada de verdad: no tiene sentido reintentar.
          if (code === DisconnectReason.loggedOut) {
            console.error('\n🔑 WhatsApp cerró la sesión. Ejecuta npm run login de nuevo.')
            stopping = true
            process.exit(1)
          }

          if (code === DisconnectReason.forbidden) {
            console.error('\n🚫 Cuenta baneada por WhatsApp.')
            stopping = true
            process.exit(1)
          }

          // 515 = restartRequired, 428/440 = conexión cerrada/reemplazada.
          // Todos son transitorios: se reintenta y WhatsApp manda otro QR.
          clearTimeout(qrTimer)
          removeQR()

          if (attempts >= MAX_ATTEMPTS) {
            console.error(`\n💥 ${MAX_ATTEMPTS} intentos sin éxito. Revisa tu conexión a internet.`)
            stopping = true
            process.exit(1)
          }

          const delay = Math.min(2000 * attempts, 8000)
          console.log(
            `❌ Conexión cerrada (code: ${code}: ${msg.slice(0, 60)}). ` +
              `Reintentando en ${delay / 1000}s...`
          )
          setTimeout(attempt, delay)
        }
      })
    } catch (e) {
      if (attempts >= MAX_ATTEMPTS) {
        console.error('\n💥 Demasiados errores seguidos:', e.message)
        process.exit(1)
      }
      console.error(`💥 Error (intento ${attempts}): ${e.message}. Reintentando...`)
      setTimeout(attempt, 3000)
    }
  })()
}

let qrPrinted = false

process.on('SIGINT', () => {
  console.log('\n👋 Cancelado.')
  stopping = true
  removeQR()
  process.exit(0)
})

attempt()