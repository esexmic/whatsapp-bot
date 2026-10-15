import { sendAnimeGif } from '../lib/gif.js'

const actionTexts = [
  'le ha dado una bofetada a',
  'ha abofeteado a',
  'le ha soltado un tortazo a'
]

function normalize(jid) {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const context = m.message?.extendedTextMessage?.contextInfo
  let targetRaw = context?.participant || context?.mentionedJid?.[0]

  if (!targetRaw) {
    return conn.sendMessage(jid, {
      text: '👋 Responde a alguien o menciónalo para abofetearlo.'
    }, { quoted: m })
  }

  const target = normalize(targetRaw)
  const senderJid = normalize(m.key?.participant || m.key?.remoteJid)

  if (!db.contacts) db.contacts = {}
  if (!conn.contacts) conn.contacts = {}

  conn.contacts[senderJid] = conn.contacts[senderJid] || { id: senderJid, notify: m.pushName, name: m.pushName }
  db.contacts[senderJid] = db.contacts[senderJid] || m.pushName

  if (!conn.contacts[target] && !db.contacts[target]) {
    const metadata = await conn.groupMetadata(jid).catch(() => null)
    if (metadata) {
      for (const p of metadata.participants) {
        const key = normalize(p.id)
        const name = p.notify || p.pushName || p.name || p.verifiedName
        if (name) {
          conn.contacts[key] = { id: key, notify: name, name: name }
          db.contacts[key] = name
        }
      }
    }
  }

  const senderName = conn.contacts[senderJid]?.notify || db.contacts[senderJid] || senderJid.split('@')[0] || 'Alguien'
  const targetName = conn.contacts[target]?.notify || db.contacts[target] || target.split('@')[0]
  const action = actionTexts[Math.floor(Math.random() * actionTexts.length)]

  try {
    await sendAnimeGif(conn, jid, 'slap', `🖐️ ${senderName} ${action} ${targetName}`, m)
  } catch (err) {
    console.error('Error en slap:', err)
    await conn.sendMessage(jid, { text: '❌ No pude obtener el GIF.' }, { quoted: m })
  }
}
