export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''

  const quotedMsg = m.message?.extendedTextMessage?.contextInfo
  const imageMessage = quotedMsg?.quotedMessage?.imageMessage

  if (!imageMessage) {
    return conn.sendMessage(jid, {
      text: 'Responde a una foto con .ver para verla.'
    }, { quoted: m })
  }

  await conn.sendMessage(jid, { text: 'guardando foto' }, { quoted: m })

  try {
    const { downloadContentFromMessage } = await import('@whiskeysockets/baileys')
    const stream = await downloadContentFromMessage(imageMessage, 'image')
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    await conn.sendMessage(jid, {
      image: buffer,
      caption: '✅ Foto solicitada\n\n*CKV BOT*'
    }, { quoted: m })
  } catch (e) {
    console.error('Error .ver:', e)
    await conn.sendMessage(jid, {
      text: 'Error al descargar la foto.'
    }, { quoted: m })
  }
}
