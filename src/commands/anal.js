import fetch from 'node-fetch'

const actionTexts = ['le ha dado por el culo a', 'ha penetrado a', 'le ha metido la verga a']

const endpoints = ['https://nekobot.xyz/api/image?type=anal']

function normalize(jid) {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
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
      await conn.sendMessage(jid, { image: { url }, caption: `🔞 ${sName} ${action} ${tName}` }, { quoted: m })
      return
    } catch {}
  }
  await conn.sendMessage(jid, { text: '❌ Error al obtener imagen.' }, { quoted: m })
}
