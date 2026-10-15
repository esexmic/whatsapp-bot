import { getSenderId, clean } from '../lib/perms.js'
import { canUse } from '../lib/roles.js'

function normalize(jid) {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
}

function getName(conn, db, jid) {
  const key = normalize(jid)
  const contact = conn.contacts?.[key]
  if (contact) return contact.notify || contact.name || contact.pushName || null
  return db?.contacts?.[key] || null
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  if (!canUse(sender, ['owner', 'admin'], db)) {
    return conn.sendMessage(jid, { text: '⛔ Solo owners o admins del bot pueden usar este comando' }, { quoted: m })
  }

  const snipes = global._snipes?.[jid]
  if (!snipes || snipes.length === 0) {
    return conn.sendMessage(jid, { text: '>×< No hay mensajes eliminados.' }, { quoted: m })
  }

  const lines = snipes.map((msg, i) => {
    const time = typeof msg.timestamp === 'number' && msg.timestamp > 1e10
      ? new Date(msg.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      : typeof msg.timestamp === 'number'
        ? new Date(msg.timestamp * 1000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        : '--:--'
    const text = msg.content
      ? (msg.content.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content)
      : '*Sin texto*'
    const name = getName(conn, db, msg.sender) || msg.sender.substring(0, 12)
    const hasImage = msg.imageMessage ? ' 📷' : ''
    return `\`${i + 1}\` │ ${name} │ ${text} │ ${time}${hasImage}`
  }).join('\n')

  let text = `╭ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╮\n`
  text += `│ ＞﹏＜ Mensajes eliminados\n`
  text += `├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤\n`
  text += lines + '\n'
  text += `╰ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╯\n`
  text += `^_^ ${snipes.length} mensajes almacenados`

  const imageEntry = snipes.find(msg => msg.imageMessage)
  if (imageEntry) {
    try {
      const { downloadContentFromMessage } = await import('@whiskeysockets/baileys')
      const stream = await downloadContentFromMessage(imageEntry.imageMessage, 'image')
      const chunks = []
      for await (const chunk of stream) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)
      await conn.sendMessage(jid, { image: buffer, caption: text }, { quoted: m })
    } catch (e) {
      console.error('Snipe image error:', e)
      await conn.sendMessage(jid, { text }, { quoted: m })
    }
  } else {
    await conn.sendMessage(jid, { text }, { quoted: m })
  }
}
