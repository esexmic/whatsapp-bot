export default async function handler(conn, m) {

    const start = Date.now()

    const jid = m?.key?.remoteJid || m.chat || m.sender
    if (!jid) return

    const sent = await conn.sendMessage(jid, {
        text: "Midiendo velocidad..."
    }, { quoted: m })

    const latency = Date.now() - start

    const text = `📶 VELOCIDAD\n\n⚡ ${latency} ms`

    await conn.sendMessage(jid, {
        text
    }, { quoted: m, edit: sent.key })
}