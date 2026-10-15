import fs from 'fs'
import path from 'path'
import { downloadMediaBuffer } from '../lib/media.js'
import { requireStaff } from '../lib/guard.js'

const COOKIE_FILE = path.join(process.cwd(), 'src', 'instagram_cookies.txt')

// Formato Netscape: dominio \t flag \t ruta \t secure \t expiración \t nombre \t valor
const NETSCAPE_LINE = /^[^\s]+\s+(TRUE|FALSE)\s+\S+\s+(TRUE|FALSE)\s+\d+\s+[^\s]+\s+\S+\s*$/

function looksLikeCookies(content, domain) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))
  if (lines.length < 2) return false
  const valid = lines.filter((l) => NETSCAPE_LINE.test(l))
  if (valid.length < lines.length) return false
  return valid.some((l) => l.toLowerCase().includes(domain))
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''

  if (!(await requireStaff(conn, m, db, { label: '.igcookies' }))) return

  const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
  if (!quotedMsg?.documentMessage) {
    return conn.sendMessage(
      jid,
      {
        text: 'Envía o responde a un archivo de cookies.txt de Instagram con .igcookies\n\nPara exportar cookies:\n1. Instala "Get cookies.txt LOCALLY" en Chrome\n2. Ve a instagram.com, inicia sesión\n3. Haz clic en la extensión y exporta\n4. Envía el archivo al chat y responde con .igcookies',
      },
      { quoted: m }
    )
  }

  try {
    const buffer = await downloadMediaBuffer(quotedMsg.documentMessage, 'document')
    if (!buffer || buffer.length < 50) throw new Error('El archivo está vacío o es inválido.')

    const content = buffer.toString('utf-8')
    if (!looksLikeCookies(content, 'instagram.com')) {
      return conn.sendMessage(
        jid,
        { text: '❌ El archivo no tiene formato de cookies de Instagram válido.' },
        { quoted: m }
      )
    }

    fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true })
    fs.writeFileSync(COOKIE_FILE, content, { encoding: 'utf-8', mode: 0o600 })
    fs.chmodSync(COOKIE_FILE, 0o600)

    await conn.sendMessage(jid, { text: '✅ Cookies de Instagram actualizadas correctamente.' }, { quoted: m })
  } catch (e) {
    console.error('[igcookies]', e.message)
    await conn.sendMessage(jid, { text: `❌ Error al guardar cookies: ${e.message}` }, { quoted: m })
  }
}