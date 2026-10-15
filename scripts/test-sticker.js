import assert from 'assert'
import { readFileSync, unlinkSync } from 'fs'
import sharp from 'sharp'
import { Readable } from 'stream'
import { encryptedStream } from '@whiskeysockets/baileys'
import webpmux from 'node-webpmux'
import { makeSticker, makeStickerWithText, toBuffer } from '../src/lib/sticker.js'
import { addStickerMetadata } from '../src/lib/sticker-exif.js'
import { downloadMediaBuffer, findMedia } from '../src/lib/media.js'
import { parseStickerOptions } from '../src/lib/sticker-options.js'
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

function readStickerMetadata(exif) {
  assert.equal(exif.toString('ascii', 0, 2), 'II')
  assert.equal(exif.readUInt16LE(10), 0x5741)
  assert.equal(exif.readUInt16LE(12), 7)
  const length = exif.readUInt32LE(14)
  const offset = exif.readUInt32LE(18)
  return JSON.parse(exif.subarray(offset, offset + length).toString('utf8'))
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
  const image = new webpmux.Image()
  await image.load(s)
  const metadata = readStickerMetadata(image.exif)
  assert.equal(metadata['sticker-pack-name'], 'MiPack')
  assert.equal(metadata['sticker-pack-publisher'], 'MiAutor')
})

await t('añade metadata sin perder la animación WebP', async () => {
  const { Image } = webpmux
  const frameBuffer = await sharp(await samplePng(64, 64)).webp().toBuffer()
  const sourceImage = new Image()
  await sourceImage.load(frameBuffer)
  const frames = [
    await Image.generateFrame({ img: sourceImage, delay: 100 }),
    await Image.generateFrame({ img: sourceImage, delay: 100 }),
  ]
  const animated = await Image.save(null, { width: 64, height: 64, frames })
  const output = await addStickerMetadata(animated, { packname: 'Animado', author: 'Bot' })
  const result = new Image()
  await result.load(output)

  assert.ok(result.hasAnim, 'se perdió la animación')
  assert.equal(result.frames.length, 2)
  const metadata = readStickerMetadata(result.exif)
  assert.equal(metadata['sticker-pack-name'], 'Animado')
  assert.equal(metadata['sticker-pack-publisher'], 'Bot')
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

console.log('\n== descarga de media WhatsApp ==')
for (const [field, type] of [
  ['imageMessage', 'image'],
  ['videoMessage', 'video'],
  ['stickerMessage', 'sticker'],
]) {
  await t(`detecta ${type} para derivar la clave de descarga`, () => {
    const content = { id: type }
    assert.deepEqual(findMedia({ [field]: content }), { content, type })
  })
}

for (const type of ['image', 'video', 'sticker', 'document']) {
  await t(`descarga ${type} como Buffer usando el tipo correcto`, async () => {
    const message = { mediaKey: Buffer.from('key') }
    const output = await downloadMediaBuffer(message, type, async (received, actualType) => {
      assert.strictEqual(received, message)
      assert.equal(actualType, type)
      return Readable.from([Buffer.from('web'), Buffer.from('p')])
    })
    assert.equal(output.toString(), 'webp')
  })
}

await t('rechaza "buffer" antes de intentar descifrar', async () => {
  await assert.rejects(
    () => downloadMediaBuffer({}, 'buffer', async () => assert.fail('no debería descargar')),
    /Tipo de medio de WhatsApp no válido/
  )
})

await t('descifra el contenido AES con el tipo exacto de Baileys', async () => {
  const original = Buffer.from('synthetic whatsapp media payload '.repeat(8))
  const encrypted = await encryptedStream(original, 'video')
  const ciphertext = readFileSync(encrypted.encFilePath)
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(ciphertext)

  try {
    const message = { mediaKey: encrypted.mediaKey, url: 'https://media.test/video' }
    const decrypted = await downloadMediaBuffer(message, 'video')
    assert.deepEqual(decrypted, original)
    await assert.rejects(() => downloadMediaBuffer(message, 'image'))
  } finally {
    globalThis.fetch = previousFetch
    unlinkSync(encrypted.encFilePath)
  }
})

console.log('\n== nombres de pack y autor ==')
await t('acepta pack y autor separados por pipe', () => {
  assert.deepEqual(parseStickerOptions(['Mi', 'Pack|Mi', 'Autor']), {
    packname: 'Mi Pack',
    author: 'Mi Autor',
  })
})
await t('acepta pack y autor separados por slash', () => {
  assert.deepEqual(parseStickerOptions(['MiPack/Autor']), { packname: 'MiPack', author: 'Autor' })
})
await t('conserva autor configurado cuando solo se cambia el pack', () => {
  assert.deepEqual(parseStickerOptions(['Nuevo'], { packname: 'Anterior', author: 'Bot' }), {
    packname: 'Nuevo',
    author: 'Bot',
  })
})
await t('usa pack y autor configurados por defecto', () => {
  assert.deepEqual(parseStickerOptions([], { packname: 'MiPack', author: 'MiBot' }), {
    packname: 'MiPack',
    author: 'MiBot',
  })
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