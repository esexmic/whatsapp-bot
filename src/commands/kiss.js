import { sendAnimeGif } from '../lib/gif.js'

const actionTexts = [
  'ha besado a',
  'le ha dado un beso a',
  'ha lanzado un beso a'
]

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

  const context = m.message?.extendedTextMessage?.contextInfo
  let targetRaw = context?.participant || context?.mentionedJid?.[0]

  if (!targetRaw) {
    return conn.sendMessage(jid, {
      text: '💋 Responde a un mensaje o menciona a alguien para darle un beso.'
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
        const name = p.notify || p.pushName || p.name || p.verifiedName || key.split('@')[0]
        if (name) {
          conn.contacts[key] = { id: key, notify: name, name: name }
          db.contacts[key] = name
        }
      }
    }
  }

  const senderName = getName(conn, db, senderJid) || senderJid.split('@')[0] || 'Alguien'
  const targetName = getName(conn, db, target) || target.split('@')[0]
  const action = actionTexts[Math.floor(Math.random() * actionTexts.length)]

  try {
    await sendAnimeGif(conn, jid, 'kiss', `💋 ${senderName} ${action} ${targetName}`, m)
  } catch (err) {
    console.error('Error en kiss:', err)
    await conn.sendMessage(jid, {
      text: '❌ No pude obtener un GIF de beso. Inténtalo de nuevo.'
    }, { quoted: m })
  }
}
