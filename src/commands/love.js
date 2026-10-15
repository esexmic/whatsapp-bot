export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  if (!chat?.endsWith('@g.us')) return

  const participants = await conn.groupMetadata(chat).then(meta => (meta.participants || []).map(p => p.id)).catch(() => [])
  // Deduplicar: si hay jids repetidos el while original se colgaba para siempre.
  const unique = [...new Set(participants)]
  if (unique.length < 2) return conn.sendMessage(chat, { text: '⚠️ No hay suficientes miembros' }, { quoted: m })

  const i1 = Math.floor(Math.random() * unique.length)
  let i2 = Math.floor(Math.random() * (unique.length - 1))
  if (i2 >= i1) i2++
  const p1 = unique[i1]
  const p2 = unique[i2]

  const percent = Math.floor(Math.random() * 101)
  const hearts = percent > 75 ? '💞' : percent > 50 ? '💗' : percent > 25 ? '💔' : '💀'

  conn.sendMessage(chat, {
    text: `${hearts} *Compatibilidad de Amor* ${hearts}\n\n@${p1.split('@')[0]}\n💕\n@${p2.split('@')[0]}\n\n*${percent}%* ${percent > 70 ? '🔥 Perfectos!' : percent > 50 ? '✨ Puede funcionar' : '😬 Mejor ni intentarlo'}`,
    mentions: [p1, p2]
  }, { quoted: m })
}
