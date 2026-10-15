export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const choice = args[0]?.toLowerCase()
  if (!choice || !['piedra', 'papel', 'tijera'].includes(choice)) {
    return conn.sendMessage(chat, { text: '⚠️ Uso: .ppt piedra / papel / tijera' }, { quoted: m })
  }

  const choices = ['piedra', 'papel', 'tijera']
  const bot = choices[Math.floor(Math.random() * 3)]
  const results = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' }
  const emojis = { piedra: '🪨', papel: '📄', tijera: '✂️' }

  let msg
  if (choice === bot) {
    msg = `🤝 *Empate!* Ambos ${choice}`
  } else if (results[choice] === bot) {
    msg = `✅ *Ganaste!* ${emojis[choice]} vs ${emojis[bot]}`
  } else {
    msg = `❌ *Perdiste!* ${emojis[choice]} vs ${emojis[bot]}`
  }
  conn.sendMessage(chat, { text: msg + '\n\n*CKV BOT*' }, { quoted: m })
}
