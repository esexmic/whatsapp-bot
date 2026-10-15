
import { env } from '../config/env.js'

// Owners hardcoded y dinámicos
// formato: { id, name (nombre en wpp), active (true/false) }
// Solo el numero, sin + ni espacios: +1 678 706 2887 -> "16787062887"
//
// En México el JID real de WhatsApp trae el "1" de movil después del 52
// (+52 1 813 588 2145 -> "5218135882145"). Se listan las dos formas para que
// el match sea directo y no dependa de expandNumber().
const HARD_OWNERS = [
  { id: "16787062887", name: "Owner", active: true },
  { id: "16787061883", name: "Owner", active: true },
  { id: "528135882145", name: "Owner", active: true },
  { id: "5218135882145", name: "Owner", active: true },
]

const ENV_OWNERS = env('OWNER_ID')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

const OWNER_IDS_RAW = [...new Set([...HARD_OWNERS.map((o) => o.id), ...ENV_OWNERS])]

export let OWNER_IDS = []

function rebuildOwnerIds() {
  OWNER_IDS = [...new Set(OWNER_IDS_RAW.map((id) => clean(id)).filter(Boolean))]
}
rebuildOwnerIds()

// 🧠 limpia cualquier formato de WhatsApp
export function clean(jid = "") {
  if (!jid) return ""

  let value = jid.toString().trim()

  if (!value) return ""

  if (value.startsWith("@")) {
    value = value.slice(1)
  }

  value = value.split("@")[0]
  value = value.replace(/:\d+/g, "")
  value = value.replace(/\D/g, "")

  return value
}

/**
 * WhatsApp identifica a cada persona con DOS ids: su numero (@s.whatsapp.net)
 * y un LID (@lid) propio del dispositivo. En grupos es normal que
 * `key.participant` venga ya como LID, y ese numero NO coincide con el del
 * owner: `isOwner` devolvia false mientras `.roles` si lo listaba como owner.
 * De ahi el "en el menu dice owner pero los comandos dicen que no".
 *
 * Baileys avisa de cada equivalencia con el evento 'lid-mapping.update' y
 * tambien llega en `contacts.upsert` (campos `lid` y `pn`). Se guardan aqui
 * para poder traducir un id al otro en el momento de comparar.
 */
const lidMap = new Map()

/** Aprende que un @lid corresponde a un @s.whatsapp.net. */
export function registerLidMapping(lid, pn) {
  const lidId = clean(lid)
  const pnId = clean(pn)
  if (lidId && pnId && lidId !== pnId) lidMap.set(lidId, pnId)
}

/**
 * Todos los ids con los que puede aparecer una misma persona: el suyo y, si
 * es un LID, tambien su numero real. Sirve para que un owner/admin guardado
 * por numero siga encontrandose cuando WhatsApp manda el mensaje por LID.
 */
export function identityIds(jid = "") {
  const ids = new Set()
  const cleaned = clean(jid)
  if (cleaned) ids.add(cleaned)
  const pn = lidMap.get(cleaned)
  if (pn) ids.add(pn)
  return [...ids]
}

// Genera variantes del número para comparación flexible
function expandNumber(num) {
  const variants = [num]
  // México: si empieza con 52, probar con/sin 1 después de 52
  if (num.startsWith("52") && num.length >= 12) {
    if (num[2] !== "1") {
      variants.push("52" + "1" + num.slice(2))
    } else {
      variants.push("52" + num.slice(3))
    }
  }
  return variants
}

function collectCandidateIds(value) {
  const ids = []
  const stack = [value]

  while (stack.length) {
    const current = stack.pop()

    if (typeof current === "string") {
      const cleaned = clean(current)
      if (cleaned) ids.push(cleaned)
    } else if (Array.isArray(current)) {
      current.forEach((item) => stack.push(item))
    } else if (current && typeof current === "object") {
      Object.values(current).forEach((item) => stack.push(item))
    }
  }

  return ids
}

function isGroupJid(jid = "") {
  return /@g\.us$/i.test(jid) || jid.includes("-g.us")
}

// 👑 CHECK OWNER (FORZADO Y SEGURO)
export function getOwnerInfo(jid = "") {
  const ids = identityIds(jid)
  if (!ids.length) return undefined
  return HARD_OWNERS.find(o => o.id && ids.includes(o.id))
}

export function isOwnerName(name = "") {
  if (!name) return false
  return HARD_OWNERS.some(o => o.name?.toLowerCase() === name.toLowerCase())
}

/** ¿Este id (ya limpio) corresponde a un owner, por cualquier via? */
function matchesOwnerId(cleaned) {
  if (!cleaned) return false
  if (HARD_OWNERS.some(o => o.active && o.id === cleaned)) return true
  if (OWNER_IDS.includes(cleaned)) return true
  // Owners añadidos dinámicamente vía .makeowner
  if (global._extraOwners?.includes(cleaned)) return true
  return false
}

export function isOwner(jid = "") {
  const cleaned = clean(jid)
  if (!cleaned) return false

  if (matchesOwnerId(cleaned)) return true

  // Si WhatsApp lo mandó como @lid, también se prueba con su numero real: sin
  // esto el owner pasaba los comandos en privado y le fallaban en grupo.
  if (identityIds(jid).some(matchesOwnerId)) return true

  // Comparación flexible con variantes
  const ids = collectCandidateIds(jid)
  const normalizedIds = ids.filter(Boolean)
  if (!normalizedIds.length || !OWNER_IDS.length) return false

  const expandedSenders = normalizedIds.flatMap(expandNumber)
  const expandedOwners = OWNER_IDS.flatMap(expandNumber)

  return expandedSenders.some((id) =>
    expandedOwners.some((ownerId) => {
      if (!ownerId) return false
      if (String(id) === String(ownerId)) return true
      // Comparación por sufijo SOLO si tiene la misma longitud: evita que un
      // número más corto que termine en el ID de un owner cuele como owner.
      if (String(id).length !== String(ownerId).length) return false
      return String(id).endsWith(String(ownerId))
    })
  )
}

// 🛡️ CHECK ADMIN
export function isAdmin(sender, db) {
  if (!sender || !db?.data?.admins) return false
  const ids = identityIds(sender)
  if (!ids.length) return false
  return db.data.admins.some(admin => ids.includes(clean(admin)))
}

// 🛡️ CHECK BANNED
export function isBanned(sender, db) {
  if (!sender || !db?.data?.banned) return false
  const ids = identityIds(sender)
  if (!ids.length) return false
  return db.data.banned.some(bannedId => ids.includes(clean(bannedId)))
}

function isLidJid(value) {
  return String(value || '').toLowerCase().endsWith('@lid')
}

/**
 * Todos los ids con los que puede venir la misma persona, de mejor a peor.
 *
 * Cada mensaje trae DOS identificadores: el que esta en uso
 * (remoteJid / participant) y el alterno (remoteJidAlt / participantAlt).
 * Baileys los separa en decode-wa-message segun el `addressing_mode` del
 * stanza: si el principal es un @lid, el alterno trae el numero real, y al
 * reves. Por eso se eligen primero los que NO son @lid: ese es el numero que
 * esta en la lista de owners y el que espera el resto de las llamadas.
 *
 * Antes se tomaba solo remoteJid/participant, asi que un owner guardado por
 * numero fallaba en cuanto WhatsApp le mandaba la conversacion por @lid.
 */
export function getSenderIds(m = {}) {
  const chatJid = m?.key?.remoteJid || m?.chat || ''
  const isGroup = isGroupJid(chatJid)

  const principal = isGroup
    ? [m?.key?.participant, m?.sender, m?.participant]
    : [m?.key?.remoteJid, m?.sender, m?.chat]

  const alterno = isGroup ? m?.key?.participantAlt : m?.key?.remoteJidAlt

  const todos = [
    ...principal,
    alterno,
    m?.author,
    m?.key?.fromMe ? m?.key?.remoteJid : '',
  ].filter(Boolean)

  const seen = new Set()
  const ids = []
  const push = (value) => {
    const c = clean(value)
    if (c && !seen.has(c)) {
      seen.add(c)
      ids.push(c)
    }
  }

  // Numero real primero, despues el @lid como ultimo recurso.
  todos.filter((v) => !isLidJid(v)).forEach(push)
  todos.filter((v) => isLidJid(v)).forEach(push)

  if (ids.length) return ids

  return collectCandidateIds(m).filter(Boolean)
}

export function getSenderId(m = {}) {
  return getSenderIds(m)[0] || ''
}

// 🛡️ DB INIT
export function initDB(db) {
  if (!db?.data) db.data = {}
  if (!db.data.admins) db.data.admins = []
  if (!db.data.banned) db.data.banned = []
}