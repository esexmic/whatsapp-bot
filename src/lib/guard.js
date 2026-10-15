import { clean, isOwner, isAdmin, getSenderId, getOwnerInfo } from './perms.js'

/**
 * Devuelve el id del usuario que ejecutó el comando, normalizado.
 *
 * Delega en getSenderId: hace lo mismo, pero además mira remoteJidAlt /
 * participantAlt para no quedarse con el @lid cuando el numero real viene en
 * el campo alterno. Tener dos copias de esta lógica es justamente lo que hizo
 * que un owner fuera owner en un comando y no en otro.
 */
export function senderOf(m = {}) {
  return getSenderId(m)
}

/** ¿El usuario es owner o admin del bot? */
export function isStaff(m, db) {
  const sender = senderOf(m)
  return isOwner(sender) || isAdmin(sender, db)
}

/** ¿Es owner o admin real del grupo de WhatsApp? */
export async function isGroupStaff(conn, m) {
  const chat = m.chat || m.key?.remoteJid || ''
  if (!chat.endsWith('@g.us')) return true
  if (isStaff(m)) return true

  const sender = senderOf(m)
  try {
    const meta = await conn.groupMetadata(chat)
    return meta?.participants?.some(
      (p) => clean(p.id) === sender && ['admin', 'superadmin'].includes(p.admin)
    )
  } catch {
    return false
  }
}

/**
 * Guarda un permiso de owner/admin.
 * Si no lo tiene, responde con el motivo y devuelve false.
 */
export async function requireStaff(conn, m, db, { ownerOnly = false, label = 'este comando' } = {}) {
  const chat = m.chat || m.key?.remoteJid || ''
  const sender = senderOf(m)

  const ok = ownerOnly ? isOwner(sender) : isStaff(m, db)
  if (ok) return true

  const quien = getOwnerInfo(sender)?.name
  await conn
    .sendMessage(
      chat,
      { text: `🔒 ${quien || 'Solo owners y admins del bot'} pueden usar ${label}.` },
      { quoted: m }
    )
    .catch(() => {})

  return false
}

/**
 * Guarda un permiso de owner/admin del bot Y admin del grupo.
 * Si no lo tiene, responde con el motivo y devuelve false.
 */
export async function requireGroupStaff(conn, m, db, { ownerOnly = false, label = 'este comando' } = {}) {
  const chat = m.chat || m.key?.remoteJid || ''
  const sender = senderOf(m)

  const okBot = ownerOnly ? isOwner(sender) : isStaff(m, db)
  if (!okBot) {
    await conn
      .sendMessage(
        chat,
        { text: `🔒 Solo owners y admins del bot pueden usar ${label}.` },
        { quoted: m }
      )
      .catch(() => {})
    return false
  }

  if (!(await isGroupStaff(conn, m))) {
    await conn
      .sendMessage(
        chat,
        { text: '🔒 Necesitas ser admin del grupo para usar este comando.' },
        { quoted: m }
      )
      .catch(() => {})
    return false
  }

  return true
}