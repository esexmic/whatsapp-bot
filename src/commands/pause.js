export default async function handler(conn, m) {
  const jid = m?.key?.remoteJid || m?.chat || m?.sender
  if (!jid) return

  if (!global._spamIntervals) global._spamIntervals = new Map()

  if (!global._spamIntervals.has(jid)) {
    return conn.sendMessage(jid, {
      text: '❌ No hay spam activo en este chat.'
    }, { quoted: m })
  }

  clearInterval(global._spamIntervals.get(jid))
  global._spamIntervals.delete(jid)

  await conn.sendMessage(jid, {
    text: '⏸️ Spam detenido.'
  }, { quoted: m })
}
