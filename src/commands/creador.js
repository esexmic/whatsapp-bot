export default async function handler(conn, m) {

    const jid = m?.key?.remoteJid || m?.chat || m?.sender
    if (!jid) return

    const text = `👑 CREADOR DEL BOT

Nombre: EzMe
📞 +52 564 444 4644`

    return await conn.sendMessage(jid, {
        text
    }, { quoted: m })

}