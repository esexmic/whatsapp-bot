import { requireStaff } from '../lib/guard.js'

const USAGE =
  '📝 *AUTORESPONDER*\n\n.autoresponder add "trigger" "response"\n.autoresponder remove "trigger"\n.autoresponder list'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''

  if (!args[0]) {
    return conn.sendMessage(jid, { text: USAGE }, { quoted: m })
  }

  // Si no hay staff, solo puede listar.
  if (!(await requireStaff(conn, m, db, { label: 'esto' })) && args[0].toLowerCase() !== 'list') {
    return
  }

  const sub = args[0].toLowerCase()
  const groupKey = jid.endsWith('@g.us') ? jid : 'global'

  if (!db.data.autoresponder) db.data.autoresponder = {}
  if (!db.data.autoresponder[groupKey]) db.data.autoresponder[groupKey] = {}

  if (sub === 'add') {
    const full = args.slice(1).join(' ')
    const match = full.match(/"([^"]+)"\s*"([^"]+)"/)
    if (!match) {
      return conn.sendMessage(jid, { text: '❌ Uso: .autoresponder add "trigger" "response"' }, { quoted: m })
    }
    const trigger = match[1].toLowerCase()
    const response = match[2]
    if (trigger.length < 3) {
      return conn.sendMessage(jid, { text: '❌ El trigger debe tener al menos 3 caracteres.' }, { quoted: m })
    }
    db.data.autoresponder[groupKey][trigger] = response
    global.saveDB?.()
    return conn.sendMessage(jid, { text: `✅ Auto-respuesta agregada:\n\n"${trigger}" → "${response}"` }, { quoted: m })
  }

  if (sub === 'remove') {
    const full = args.slice(1).join(' ')
    const match = full.match(/"([^"]+)"/)
    if (!match) {
      return conn.sendMessage(jid, { text: '❌ Uso: .autoresponder remove "trigger"' }, { quoted: m })
    }
    const trigger = match[1].toLowerCase()
    if (!db.data.autoresponder[groupKey]?.[trigger]) {
      return conn.sendMessage(jid, { text: `❌ No existe la auto-respuesta para "${trigger}"` }, { quoted: m })
    }
    delete db.data.autoresponder[groupKey][trigger]
    global.saveDB?.()
    return conn.sendMessage(jid, { text: `🗑️ Auto-respuesta eliminada: "${trigger}"` }, { quoted: m })
  }

  if (sub === 'list') {
    const entries = {
      ...(db.data.autoresponder.global || {}),
      ...(db.data.autoresponder[groupKey] || {}),
    }
    const keys = Object.keys(entries)
    if (!keys.length) {
      return conn.sendMessage(jid, { text: '📝 No hay auto-respuestas configuradas.' }, { quoted: m })
    }
    const list = keys.map((k) => `"${k}" → "${entries[k]}"`).join('\n')
    return conn.sendMessage(jid, { text: `📝 *AUTO-RESPUESTAS*\n\n${list}` }, { quoted: m })
  }

  return conn.sendMessage(jid, { text: '❌ Subcomando inválido. Usa: add, remove, list' }, { quoted: m })
}