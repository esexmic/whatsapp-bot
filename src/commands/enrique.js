import axios from 'axios'
import { canUse, normalize } from "../lib/roles.js"
import { getSenderId, isOwner, isAdmin, clean, identityIds } from "../lib/perms.js"

export function selectEnriqueTargets(participants, { botIds = [], senderId = '', ownerCheck = isOwner, adminCheck = (jid, db) => isAdmin(jid, db), db = null } = {}) {
  const botSet = new Set()
  for (const raw of botIds) {
    if (!raw) continue
    for (const id of identityIds(raw)) {
      const safe = clean(id)
      if (safe) botSet.add(safe)
    }
  }

  const senderSet = new Set()
  for (const raw of [senderId]) {
    if (!raw) continue
    for (const id of identityIds(raw)) {
      const safe = clean(id)
      if (safe) senderSet.add(safe)
    }
  }

  return (participants || [])
    .map((p) => (typeof p === 'string' ? p : p?.id))
    .filter(Boolean)
    .filter((jid) => {
      const pid = clean(jid)
      if (!pid) return false
      if (botSet.has(pid)) return false
      if (senderSet.has(pid)) return false

      const ownerMatch = ownerCheck && (ownerCheck(jid) || ownerCheck(pid))
      if (ownerMatch) return false

      const adminMatch = adminCheck && (adminCheck(jid, db) || adminCheck(pid, db))
      if (adminMatch) return false

      return true
    })
}

let handler = async (conn, m, args, db) => {
  const user = normalize(getSenderId(m))

  if (!canUse(user, ["owner", "admin"], db)) {
    return conn.sendMessage(m.key.remoteJid, {
      text: "⛔ No tienes permisos para usar este comando."
    })
  }

  const botIds = [conn.user?.id, conn.user?.jid, conn.user?.lid].filter(Boolean)
  const senderId = getSenderId(m)

  console.log('[ENRIQUE] botIds:', botIds)

  const metadata = await conn.groupMetadata(m.key.remoteJid).catch(() => null)
  if (!metadata?.participants?.length) {
    return conn.sendMessage(m.key.remoteJid, {
      text: "⚠️ No se pudo obtener la lista del grupo."
    })
  }

  const targets = selectEnriqueTargets(metadata.participants, {
    botIds,
    senderId,
    ownerCheck: isOwner,
    adminCheck: (jid) => isAdmin(jid, db),
    db,
  })

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

  const batches = []
  for (let i = 0; i < targets.length; i += 10) {
    batches.push(targets.slice(i, i + 10))
  }

  const results = await Promise.allSettled(
    batches.map((batch) => conn.groupParticipantsUpdate(m.key.remoteJid, batch, "remove"))
  )

  const kicked = results.reduce((count, result) => {
    if (result.status === 'fulfilled') {
      const rows = Array.isArray(result.value) ? result.value : []
      return count + rows.filter((row) => row?.status === 'success').length
    }
    return count
  }, 0)

  return conn.sendMessage(m.key.remoteJid, {
    text: `✅ Eliminación completada (${kicked}/${targets.length})`
  })
}

handler.command = ["kickall"]
handler.group = true
handler.botAdmin = true

export default handler
