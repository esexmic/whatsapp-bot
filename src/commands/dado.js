export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const result = Math.floor(Math.random() * 6) + 1
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
  conn.sendMessage(chat, { text: `🎲 *Dado*\n\n${faces[result - 1]} ${result}` }, { quoted: m })
}
