import { requireStaff } from '../lib/guard.js'

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  if (!jid.endsWith('@g.us')) {
    return conn.sendMessage(jid, { text: '⚠️ Este comando solo funciona en grupos' }, { quoted: m })
  }

  if (!(await requireStaff(conn, m, db, { label: '.antivirgenes' }))) return

  if (!db.data.antivirgenes) db.data.antivirgenes = []

  const idx = db.data.antivirgenes.indexOf(jid)
  if (idx === -1) {
    db.data.antivirgenes.push(jid)
  } else {
    db.data.antivirgenes.splice(idx, 1)
  }

  global.saveDB?.()

  return conn.sendMessage(jid, {
    text:
      idx === -1
        ? '✅ Antivirgenes ACTIVADO. Cualquier contacto compartido será expulsado.'
        : '✅ Antivirgenes DESACTIVADO.',
  }, { quoted: m })
}