import webpmux from 'node-webpmux'

const { Image } = webpmux

function cleanText(value) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 100)
}

export function createStickerExif({ packname = 'bot', author = 'xyb' } = {}) {
  const payload = Buffer.from(JSON.stringify({
    'sticker-pack-id': 'com.whatsapp.sticker',
    'sticker-pack-name': cleanText(packname),
    'sticker-pack-publisher': cleanText(author),
    emojis: [],
  }))

  const header = Buffer.alloc(22)
  header.write('II', 0, 'ascii')
  header.writeUInt16LE(42, 2)
  header.writeUInt32LE(8, 4)
  header.writeUInt16LE(1, 8)
  header.writeUInt16LE(0x5741, 10)
  header.writeUInt16LE(7, 12)
  header.writeUInt32LE(payload.length, 14)
  header.writeUInt32LE(header.length, 18)

  return Buffer.concat([header, payload])
}

export async function addStickerMetadata(webpBuffer, metadata) {
  const image = new Image()
  await image.load(webpBuffer)
  image.exif = createStickerExif(metadata)
  return image.save(null)
}