import { clean } from './perms.js'

/**
 * Cache de nombres de contactos.
 *
 * Baileys no expone `conn.contacts`, pero muchos comandos lo usan. Este módulo
 * centraliza la escritura: `cacheContact` nunca falla aunque `conn.contacts`
 * no exista, y guarda siempre en el formato { id, notify, name } que los
 * comandos leen.
 */

function ensure(conn) {
  if (!conn.contacts || typeof conn.contacts !== 'object') conn.contacts = {}
  return conn.contacts
}

/** Guarda un nombre de contacto. Devuelve true si cambió. */
export function cacheContact(conn, jid, name, db = global.db) {
  if (!jid || !name) return false
  const key = jid.split(':')[0]
  let changed = false

  try {
    const cache = ensure(conn)
    if (!cache[key] || cache[key].notify !== name) {
      cache[key] = { id: key, notify: name, name }
      changed = true
    }
  } catch {}

  try {
    if (db?.contacts) {
      const existing = db.contacts[key]
      if (existing !== name) {
        db.contacts[key] = name
        changed = true
      }
    }
  } catch {}

  return changed
}

/** Nombre de un contacto, con fallback al número. */
export function contactName(conn, jid, db = global.db) {
  if (!jid) return ''

  // Un mismo contacto llega como "521555@s.whatsapp.net", "521555:12@..." o
  // "521555:12". Hay que probar todas las formas.
  const raw = String(jid)
  const digits = raw.split('@')[0].split(':')[0]
  const server = raw.includes('@') ? raw.split('@')[1] : 's.whatsapp.net'
  const keys = [
    raw,
    `${digits}@${server}`,
    server === 's.whatsapp.net' ? `${digits}@s.whatsapp.net` : null,
    digits,
  ].filter(Boolean)

  for (const key of keys) {
    const fromCache = conn?.contacts?.[key]?.notify || conn?.contacts?.[key]?.name
    if (fromCache) return fromCache
  }
  for (const key of keys) {
    const v = db?.contacts?.[key]
    if (v) return typeof v === 'string' ? v : v.notify || v.name
  }

  return digits
}