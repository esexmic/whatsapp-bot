import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const HAS_GIT = process.platform !== 'win32' || true

async function git(args) {
  const { stdout } = await execFileAsync('git', args, { timeout: 5000, windowsHide: true })
  return stdout.trim()
}

export default async function handler(conn, m) {
  const jid = m.chat || m.key?.remoteJid || ''

  try {
    const hash = await git(['log', '-1', '--format=%H'])
    const msg = await git(['log', '-1', '--format=%s'])
    const date = await git(['log', '-1', '--format=%ai'])
    const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'])

    await conn.sendMessage(jid, {
      text:
        `📦 *VERSIÓN ACTUAL*\n\n` +
        `🔀 Rama: ${branch}\n` +
        `💬 Commit: \`${hash.slice(0, 7)}\`\n` +
        `📝 ${msg}\n` +
        `🕐 ${date}\n` +
        `🔗 ${hash}`,
    }, { quoted: m })
  } catch (e) {
    await conn
      .sendMessage(jid, { text: `❌ No pude leer git: ${String(e.message).slice(0, 120)}` }, { quoted: m })
      .catch(() => {})
  }
}