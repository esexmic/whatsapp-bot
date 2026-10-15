import fetch from 'node-fetch'
import { gifToMp4 } from '../lib/gif.js'

const actionTexts = [
  'se ha puesto hot con',
  'está caliente con',
  'quiere divertirse con'
]

const nsfwEndpoints = [
  'https://purrbot.site/api/img/nsfw/neko/gif',
  'https://purrbot.site/api/img/nsfw/blowjob/gif',
  'https://nekobot.xyz/api/image?type=hentai',
  'https://nekobot.xyz/api/image?type=blowjob',
  'https://nekobot.xyz/api/image?type=anal',
  'https://nekobot.xyz/api/image?type=boobs',
  'https://nekobot.xyz/api/image?type=pussy'
]

function normalize(jid) {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
}

async function sendNsfw(conn, jid, url, caption, quoted) {
  const isGif = url.match(/\.gif($|\?)/i)
  if (isGif) {
    const mp4 = await gifToMp4(url)
    await conn.sendMessage(jid, { video: mp4, gifPlayback: true, caption }, { quoted })
  } else {
    await conn.sendMessage(jid, { image: { url }, caption }, { quoted })
  }
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const context = m.message?.extendedTextMessage?.contextInfo
  let targetRaw = context?.participant || context?.mentionedJid?.[0]

  if (!targetRaw) {
    return conn.sendMessage(jid, {
      text: '🔞 Responde a alguien o menciónalo.'
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

  for (let attempt = 0; attempt < nsfwEndpoints.length; attempt++) {
    try {
      const res = await fetch(nsfwEndpoints[attempt])
      const json = await res.json()
      const mediaUrl = json.link || json.url || json.message
      if (!mediaUrl) continue

      await sendNsfw(conn, jid, mediaUrl, `🔞 ${senderName} ${action} ${targetName}`, m)
      return
    } catch {}
  }

  await conn.sendMessage(jid, { text: '❌ No pude obtener el GIF.' }, { quoted: m })
}
