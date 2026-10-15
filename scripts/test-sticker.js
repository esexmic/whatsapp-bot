import assert from 'assert'
import sharp from 'sharp'
import { makeSticker, makeStickerWithText, toBuffer } from '../src/lib/sticker.js'
import { cacheContact, contactName } from '../src/lib/contacts.js'

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

async function samplePng(w = 800, h = 600) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 10, g: 120, b: 200 } } })
    .png()
    .toBuffer()
}

console.log('\n== sticker (reemplazo de wa-sticker-formatter) ==')

await t('genera WebP 512x512 desde PNG', async () => {
  const s = await makeSticker(await samplePng(), { packname: 'CKV', author: 'Bot' })
  const m = await sharp(s).metadata()
  assert.equal(m.format, 'webp')
  assert.equal(m.width, 512)
  assert.equal(m.height, 512)
})

await t('redimensiona imagen pequeña sin romper', async () => {
  const s = await makeSticker(await samplePng(100, 80), {})
  const m = await sharp(s).metadata()
  assert.equal(m.width, 512)
})

await t('acepta un sticker WebP de entrada (caso .wm)', async () => {
  const first = await makeSticker(await samplePng(), { packname: 'A', author: 'B' })
  const second = await makeSticker(first, { packname: 'Nuevo', author: 'Yo' })
  const m = await sharp(second).metadata()
  assert.equal(m.format, 'webp')
  assert.equal(m.width, 512)
})

await t('incluye EXIF con pack y autor', async () => {
  const s = await makeSticker(await samplePng(), { packname: 'MiPack', author: 'MiAutor' })
  const m = await sharp(s).metadata()
  assert.ok(m.exif && m.exif.length > 0, 'sin EXIF: WhatsApp no mostraría el pack')
})

await t('acepta base64 y URL-like strings', async () => {
  const png = await samplePng(200, 200)
  const b64 = png.toString('base64')
  const s = await makeSticker(b64, {})
  assert.ok(s.length > 100)
})

await t('sticker con texto (para .globo)', async () => {
  const s = await makeStickerWithText(await samplePng(), 'HOLAAA')
  const m = await sharp(s).metadata()
  assert.equal(m.format, 'webp')
  assert.equal(m.width, 512)
})

await t('lanza error claro con basura', async () => {
  let err = null
  try {
    await makeSticker(Buffer.from('esto no es una imagen'), {})
  } catch (e) {
    err = e
  }
  assert.ok(err, 'debería lanzar con entrada inválida')
})

console.log('\n== toBuffer ==')
await t('normaliza Buffer', async () => {
  const b = Buffer.from([1, 2, 3])
  assert.strictEqual(await toBuffer(b), b)
})
await t('normaliza base64', async () => {
  const out = await toBuffer(Buffer.from('hola').toString('base64'))
  assert.equal(out.toString(), 'hola')
})
await t('rechaza null', async () => {
  await assert.rejects(() => toBuffer(null))
})

console.log('\n== contacts (el crash "Cannot set properties of undefined") ==')
await t('cacheContact funciona si conn.contacts NO existe', () => {
  // Este es exactamente el caso que reventaba en producción.
  const conn = {}
  const db = { contacts: {} }
  assert.equal(cacheContact(conn, '521111@s.whatsapp.net', 'Juan', db), true)
  assert.equal(conn.contacts['521111@s.whatsapp.net'].notify, 'Juan')
  assert.equal(db.contacts['521111@s.whatsapp.net'], 'Juan')
})

await t('cacheContact no lanza si conn es un frozen object', () => {
  const conn = Object.freeze({})
  const db = { contacts: {} }
  cacheContact(conn, '521222@s.whatsapp.net', 'Ana', db)
  assert.equal(db.contacts['521222@s.whatsapp.net'], 'Ana')
})

await t('cacheContact devuelve false si nada cambia', () => {
  const conn = { contacts: { '521333@s.whatsapp.net': { notify: 'Luis' } } }
  const db = { contacts: { '521333@s.whatsapp.net': 'Luis' } }
  assert.equal(cacheContact(conn, '521333@s.whatsapp.net', 'Luis', db), false)
})

await t('contactName resuelve desde db y desde cache', () => {
  const conn = { contacts: { a: { notify: 'DeCache' } } }
  const db = { contacts: { b: 'DeDB' } }
  assert.equal(contactName(conn, 'a', db), 'DeCache')
  assert.equal(contactName(conn, 'b', db), 'DeDB')
  assert.equal(contactName(conn, '521444@s.whatsapp.net', db), '521444')
})

await t('contactName con jid sucio (@lid, device)', () => {
  const conn = {}
  const db = { contacts: { '521555@s.whatsapp.net': 'ConDevice' } }
  assert.equal(contactName(conn, '521555:12@s.whatsapp.net', db), 'ConDevice')
})

console.log(`\n${pass} pasaron, ${fail} fallaron\n`)
process.exit(fail > 0 ? 1 : 0)