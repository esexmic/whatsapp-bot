import { clean, isOwner, getOwnerInfo } from "./perms.js"

export function normalize(jid = "") {
  return clean(jid)
}

export function getOwnerName(jid = "") {
  const info = getOwnerInfo(jid)
  return info?.name || ""
}

export function canUse(jid = "", roles = [], db) {
  const id = normalize(jid)
  if (!id) return false

  if (roles.includes("owner") && isOwner(id)) return true

  if (roles.includes("admin") && Array.isArray(db?.data?.admins)) {
    return db.data.admins.some((adminId) => normalize(adminId) === id)
  }

  return false
}
