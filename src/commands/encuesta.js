export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  if (!chat?.endsWith('@g.us')) return

  const input = args.join(' ').split('|').map(s => s.trim()).filter(Boolean)
  if (input.length < 2) {
    return conn.sendMessage(chat, { text: '⚠️ Uso: .encuesta Pregunta|Op1|Op2|...\nEj: .encuesta Donde vamos?|Playa|Montaña' }, { quoted: m })
  }

  const question = input[0]
  const options = input.slice(1)
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
  const text = `📊 *${question}*\n\n${options.map((o, i) => `${emojis[i] || `${i + 1}.`} ${o}`).join('\n')}`

  conn.sendMessage(chat, { text: `${text}\n\n*CKV BOT*` }, { quoted: m })
}
