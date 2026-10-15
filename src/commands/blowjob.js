import fetch from 'node-fetch'
import { gifToMp4 } from '../lib/gif.js'

const actionTexts = ['le ha hecho una paja a', 'le ha mamado la verga a', 'le ha chupado el pene a']

const endpoints = [
  'https://purrbot.site/api/img/nsfw/blowjob/gif',
  'https://nekobot.xyz/api/image?type=blowjob'
]

function normalize(jid) {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
}

async function sendMedia(conn, jid, url, caption, quoted) {
  if (url.match(/\.gif($|\?)/i)) {
    const mp4 = await gifToMp4(url)
    await conn.sendMessage(jid, { video: mp4, gifPlayback: true, caption }, { quoted })
  } else {
    await conn.sendMessage(jid, { image: { url }, caption }, { quoted })
  }
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const ctx = m.message?.extendedTextMessage?.contextInfo
  let target = ctx?.participant || ctx?.mentionedJid?.[0]
  if (!target) return conn.sendMessage(jid, { text: '🔞 Responde o menciona a alguien.' }, { quoted: m })

  target = normalize(target)
  const sender = normalize(m.key?.participant || m.key?.remoteJid)
  const sName = conn.contacts?.[sender]?.notify || db?.contacts?.[sender] || sender.split('@')[0] || 'Alguien'
  const tName = conn.contacts?.[target]?.notify || db?.contacts?.[target] || target.split('@')[0]
  const action = actionTexts[Math.floor(Math.random() * actionTexts.length)]

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep)
      const json = await res.json()
      const url = json.link || json.url || json.message
      if (!url) continue
      await sendMedia(conn, jid, url, `🔞 ${sName} ${action} ${tName}`, m)
      return
    } catch {}
  }
  await conn.sendMessage(jid, { text: '❌ Error al obtener imagen.' }, { quoted: m })
}
