import { OWNER_IDS, getOwnerInfo } from "../lib/perms.js"

function normalize(jid) {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net'
}

/**
 * Nombre que el bot tiene cacheado de WhatsApp.
 *
 * El bot guarda el nombre cuando ve a alguien escribir (contacts.upsert y
 * cacheContact), así que de ahi sale el nombre real. Se prueban las dos claves
 * porque un contacto puede estar guardado como @s.whatsapp.net o como @lid,
 * segun como haya llegado su mensaje.
 */
function nombreCacheado(db, id) {
  if (!id) return ''
  const numero = String(id).split('@')[0].split(':')[0]
  return db.contacts?.[`${numero}@s.whatsapp.net`] || db.contacts?.[`${numero}@lid`] || ''
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ""
  const admins = db?.data?.admins || []

  const allOwners = [...new Set([...OWNER_IDS, ...(global._extraOwners || [])])]

  // En los owners manda el nombre de HARD_OWNERS: es el que puso el dueño del
  // bot y no cambia cada vez que alguien lo renombra en su perfil. Si no hay,
  // se cae al nombre cacheado de WhatsApp y, en último caso, al número.
  const ownerList = allOwners
    .map((id) => getOwnerInfo(id)?.name || nombreCacheado(db, id) || normalize(id).split('@')[0])
    .filter(Boolean)

  // En los admins sí manda el nombre de WhatsApp: no hay nombre fijo para
  // ellos, y son los que el bot va aprendiendo de los mensajes del grupo.
  const adminList = admins
    .map((id) => nombreCacheado(db, id) || normalize(id).split('@')[0])
    .filter(Boolean)

  const text =
    `👑 ROLES\n\n` +
    `👤 OWNERS\n${ownerList.length ? ownerList.join("\n") : "sin configurar"}\n\n` +
    `🛡️ ADMINISTRADORES\n${adminList.length ? adminList.join("\n") : "Ninguno"}`

  return conn.sendMessage(jid, { text }, { quoted: m })
}