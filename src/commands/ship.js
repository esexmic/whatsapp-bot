import { fetchGifUrl, gifToMp4 } from '../lib/gif.js'

function normalize(jid) {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
}

function getName(conn, db, jid) {
  const key = normalize(jid)
  const c = conn.contacts?.[key]
  if (c) return c.notify || c.name || c.pushName || null
  return db?.contacts?.[key] || null
}

function makeShipName(a, b) {
  const aHalf = a.slice(0, Math.ceil(a.length / 2))
  const bHalf = b.slice(Math.floor(b.length / 2))
  return aHalf + bHalf
}

function hearts(pct) {
  const filled = Math.round(pct / 10)
  return '❤️'.repeat(filled) + '🖤'.repeat(10 - filled)
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const ctx = m.message?.extendedTextMessage?.contextInfo
  const mentioned = ctx?.mentionedJid || []
  const replied = ctx?.participant

  let user1, user2

  if (replied && mentioned.length >= 1) {
    user1 = replied
    user2 = mentioned[0]
  } else if (mentioned.length >= 2) {
    user1 = mentioned[0]
    user2 = mentioned[1]
  } else if (replied) {
    user1 = m.key?.participant || m.key?.remoteJid
    user2 = replied
  } else {
    return conn.sendMessage(jid, {
      text: '💕 Responde a alguien o menciona a 2 personas para shipearlos.\n\nEj: !ship @usuario1 @usuario2'
    }, { quoted: m })
  }

  if (!db.contacts) db.contacts = {}
  if (!conn.contacts) conn.contacts = {}

  const u1 = normalize(user1)
  const u2 = normalize(user2)
  const senderJid = normalize(m.key?.participant || m.key?.remoteJid)

  for (const id of [senderJid, u1, u2]) {
    if (!conn.contacts[id] && m.pushName) {
      conn.contacts[id] = { id, notify: m.pushName, name: m.pushName }
      db.contacts[id] = m.pushName
    }
  }

  const name1 = getName(conn, db, u1) || u1.split('@')[0]
  const name2 = getName(conn, db, u2) || u2.split('@')[0]
  const shipName = makeShipName(name1, name2)
  const percent = Math.floor(Math.random() * 101)
  const bar = hearts(percent)

  const texts = percent >= 90 ? '🔥 Almas gemelas!' :
    percent >= 70 ? '💞 Hay química!' :
    percent >= 50 ? '💗 Podría funcionar...' :
    percent >= 30 ? '💔 Tal vez solo amigos...' :
    '💀 No hay chance.'

  const caption = [
    `💕 *SHIP - ${shipName}*`,
    ``,
    `👤 ${name1}`,
    `👤 ${name2}`,
    ``,
    `${bar}  **${percent}%**`,
    `${texts}`
  ].join('\n')

  try {
    const gifUrl = await fetchGifUrl('kiss')
    const mp4 = await gifToMp4(gifUrl)
    await conn.sendMessage(jid, { video: mp4, gifPlayback: true, caption }, { quoted: m })
  } catch {
    await conn.sendMessage(jid, { text: caption }, { quoted: m })
  }
}
