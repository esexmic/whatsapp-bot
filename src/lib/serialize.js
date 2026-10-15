export function serialize(m) {
  if (!m) return m

  const chat = m.key?.remoteJid || ''
  const isGroup = chat.endsWith('@g.us')

  m.chat = chat
  m.isGroup = isGroup
  m.sender = isGroup
    ? (m.key?.participant || m.participant || '')
    : (m.key?.remoteJid || '')

  m.text =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    ''

  const ctx = m.message?.extendedTextMessage?.contextInfo || {}
  m.mentionedJid = ctx.mentionedJid || []

  if (ctx?.quotedMessage && ctx?.participant) {
    m.quoted = {
      sender: ctx.participant,
      stanzaId: ctx.stanzaId,
      message: ctx.quotedMessage,
    }
    const quoted = ctx.quotedMessage
    m.quoted.text =
      quoted?.conversation ||
      quoted?.extendedTextMessage?.text ||
      quoted?.imageMessage?.caption ||
      quoted?.videoMessage?.caption ||
      ''
  }

  return m
}
