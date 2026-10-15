
import { env } from '../config/env.js'

// Owners hardcoded y dinámicos
// formato: { id, name (nombre en wpp), active (true/false) }
const HARD_OWNERS = [
  { id: "16787062887", name: "Owner", active: true },
  { id: "16787061883", name: "Owner", active: true },
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
  const cleaned = clean(jid)
  return HARD_OWNERS.find(o => o.id === cleaned)
}

export function isOwnerName(name = "") {
  if (!name) return false
  return HARD_OWNERS.some(o => o.name?.toLowerCase() === name.toLowerCase())
}

export function isOwner(jid = "") {
  const cleaned = clean(jid)
  if (!cleaned) return false

  if (HARD_OWNERS.some(o => o.active && o.id === cleaned)) return true

  if (OWNER_IDS.includes(cleaned)) return true

  // Owners añadidos dinámicamente vía .makeowner
  if (global._extraOwners?.includes(cleaned)) return true

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
  const cleanSender = clean(sender)
  return db.data.admins.some(admin => clean(admin) === cleanSender)
}

// 🛡️ CHECK BANNED
export function isBanned(sender, db) {
  if (!sender || !db?.data?.banned) return false
  const cleanSender = clean(sender)
  return db.data.banned.some(bannedId => clean(bannedId) === cleanSender)
}

export function getSenderId(m = {}) {
  const chatJid = m?.key?.remoteJid || m?.chat || ""
  const isGroup = isGroupJid(chatJid)

  const candidates = [
    m?.sender,
    m?.key?.participant,
    m?.participant,
    m?.author,
    m?.message?.extendedTextMessage?.contextInfo?.participant,
    isGroup ? "" : m?.key?.remoteJid,
    isGroup ? "" : m?.chat,
    m?.key?.fromMe ? m?.key?.remoteJid : ""
  ].filter(Boolean)

  for (const value of candidates) {
    const cleaned = clean(value)
    if (cleaned) return cleaned
  }

  const scanned = collectCandidateIds(m)
  return scanned.find(Boolean) || ""
}

// 🛡️ DB INIT
export function initDB(db) {
  if (!db?.data) db.data = {}
  if (!db.data.admins) db.data.admins = []
  if (!db.data.banned) db.data.banned = []
}