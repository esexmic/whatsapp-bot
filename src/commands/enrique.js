import axios from 'axios'
import { canUse, normalize } from "../lib/roles.js"
import { getSenderId, isOwner, isAdmin, clean } from "../lib/perms.js"

let handler = async (conn, m, args, db) => {
  const user = normalize(getSenderId(m))

  if (!canUse(user, ["owner", "admin"], db)) {
    return conn.sendMessage(m.key.remoteJid, {
      text: "⛔ No tienes permisos para usar este comando."
    })
  }

  const rawBotId = conn.user?.id || conn.user?.jid || ''
  const botId = clean(rawBotId) || ''
  console.log('[ENRIQUE] rawBotId:', rawBotId, 'cleaned:', botId)

  const metadata = await conn.groupMetadata(m.key.remoteJid).catch(() => null)
  if (!metadata?.participants?.length) {
    return conn.sendMessage(m.key.remoteJid, {
      text: "⚠️ No se pudo obtener la lista del grupo."
    })
  }

  const senderClean = clean(getSenderId(m))

  const targets = metadata.participants
    .filter(p => {
      const pid = clean(p.id)
      if (!pid) return false
      if (botId && pid === botId) return false
      if (isOwner(p.id)) return false
      if (isAdmin(p.id, db)) return false
      if (pid === senderClean) return false
      return true
    })
    .map(p => p.id)

  console.log('[ENRIQUE] total participants:', metadata.participants.length, 'targets:', targets.length)

  if (!targets.length) {
    return conn.sendMessage(m.key.remoteJid, {
      text: "⚠️ No hay usuarios para eliminar."
    })
  }

  try {
    const imgRes = await axios.get("https://cdn.discordapp.com/attachments/1515876880795041953/1523123917865095218/descarga_1.jfif?ex=6a4af730&is=6a49a5b0&hm=6a9a09e602d2e4ee22c393c258ac9614bf72009c98bb01258a3e2707389a60e8&", { responseType: 'arraybuffer' })
    if (imgRes?.data) {
      await conn.updateProfilePicture(m.key.remoteJid, Buffer.from(imgRes.data))
    }
  } catch (e) {
    console.log('[ENRIQUE] error foto:', e?.message?.slice(0, 80))
  }
  await conn.groupUpdateSubject(m.key.remoteJid, "Favela do CKV 🤣😂").catch(() => {})

  const inviteCode = await conn.groupInviteCode(m.key.remoteJid).catch(() => null)
  const inviteLink = inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : ''

  await conn.sendMessage(m.key.remoteJid, {
    text: `Favela do CKV 🤣😂\n${inviteLink}`,
    mentions: targets
  }).catch(() => {})

  let kicked = 0
  try {
    const result = await conn.groupParticipantsUpdate(m.key.remoteJid, targets, "remove")
    if (Array.isArray(result)) {
      kicked = result.filter(r => r.status === 'success').length
    }
  } catch (e) {
    console.log('[ENRIQUE] falló llamado completo, haciendo por lotes:', e?.message?.slice(0,80))
  }

  if (kicked === 0) {
    for (let i = 0; i < targets.length; i += 10) {
      const batch = targets.slice(i, i + 10)
      try {
        await conn.groupParticipantsUpdate(m.key.remoteJid, batch, "remove")
        kicked += batch.length
      } catch {}
    }
  }

  return conn.sendMessage(m.key.remoteJid, {
    text: `✅ Eliminación completada (${kicked}/${targets.length})`
  })
}

handler.command = ["kickall"]
handler.group = true
handler.botAdmin = true

export default handler
