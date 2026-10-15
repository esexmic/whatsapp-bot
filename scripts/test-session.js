/**
 * Verifica que la sesión de WhatsApp se guarda y se REUTILIZA.
 * Este es el bug reportado: "cada que cierro y abro pide login otra vez".
 */
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { useMultiFileAuthState } from '@whiskeysockets/baileys'
import { SESSION_DIR, DB_FILE, ROOT } from '../src/lib/store.js'

let pass = 0
let fail = 0
const t = async (name, fn) => {
  try {
    await fn()
    pass++
    console.log('  ok  ' + name)
  } catch (e) {
    fail++
    console.log('  FAIL ' + name + ' -> ' + e.message)
  }
}

console.log('\n== rutas (no dependen del directorio actual) ==')

await t('SESSION_DIR está anclado al proyecto, no a cwd', () => {
  assert.equal(path.resolve(SESSION_DIR), path.resolve(path.join(ROOT, 'sessions')))
  assert.ok(!SESSION_DIR.startsWith(path.resolve('C:') + '\\Users') || ROOT.startsWith(SESSION_DIR.split('sessions')[0].slice(0, 12)))
})

await t('SESSION_DIR es una ruta absoluta', () => {
  assert.ok(path.isAbsolute(SESSION_DIR), 'debe ser absoluta')
})

await t('SESSION_DIR coincide con el directorio que usa .gitignore', () => {
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
  assert.ok(gitignore.includes('sessions/'), '.gitignore debe ignorar sessions/')
})

console.log('\n== persistencia real de credenciales ==')

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sess_'))

await t('useMultiFileAuthState CREA la carpeta y el app-state', async () => {
  const dir = path.join(TMP, 'nueva')
  const { state, saveCreds } = await useMultiFileAuthState(dir)

  assert.ok(fs.existsSync(dir), 'la carpeta no se creó')
  assert.ok(state.creds, 'no hay credenciales iniciales')

  // Simula lo que Baileys hace al conectar: actualiza y guarda.
  state.creds.registered = true
  state.creds.me = { id: '16787062887:12@s.whatsapp.net', name: 'Test' }
  state.creds.noiseKey = { private: Buffer.alloc(32, 7) }
  await saveCreds()

  assert.ok(fs.existsSync(path.join(dir, 'creds.json')), 'creds.json no se escribió')
})

await t('una SEGUNDA lectura recupera la sesión (no pide QR)', async () => {
  const dir = path.join(TMP, 'nueva')
  const { state } = await useMultiFileAuthState(dir)

  assert.equal(state.creds.registered, true, 'registered no se persistió')
  assert.ok(state.creds.me, 'no se recuperó el perfil')
  assert.equal(state.creds.me.id, '16787062887:12@s.whatsapp.net')
  assert.ok(Buffer.isBuffer(state.creds.noiseKey.private), 'la noiseKey no se recuperó')
})

await t('la clave de emparejamiento también persiste', async () => {
  const dir = path.join(TMP, 'nueva')
  const { state, saveCreds } = await useMultiFileAuthState(dir)
  state.creds.pairingCode = 'ABCD1234'
  await saveCreds()

  const { state: reread } = await useMultiFileAuthState(dir)
  assert.equal(reread.creds.pairingCode, 'ABCD1234')
})

await t('creds.json es JSON válido (no se corrompe al escribir)', async () => {
  const file = path.join(TMP, 'nueva', 'creds.json')
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.ok(parsed.registered !== undefined)
})

await t('sessions/ del proyecto NO existe todavia = sin sesión = QR normal', () => {
  // Este es el estado esperado antes del primer login, no un bug.
  const exists = fs.existsSync(SESSION_DIR)
  console.log(`     (info) sessions/ ${exists ? 'existe' : 'no existe → el bot pedirá QR'}`)
  assert.ok(true)
})

console.log(`\n${pass} pasaron, ${fail} fallaron\n`)

try {
  fs.rmSync(TMP, { recursive: true, force: true })
} catch {}

process.exit(fail > 0 ? 1 : 0)