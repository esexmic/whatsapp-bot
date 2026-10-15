import webpmux from 'node-webpmux'

const { Image } = webpmux

function cleanText(value) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 100)
}

/**
 * ¿El buffer es un WebP animado?
 *
 * Solo se reescribe el EXIF de los animados: pasar cualquier sticker por sharp
 * con `animated: false` (su default) lo aplana al primer frame y el sticker
 * vuelve quieto. Detecta los chunks ANIM/ANMF, que solo existen en animaciones.
 *
 * Recorre el contenedor RIFF a mano y nunca lanza: cualquier buffer raro
 * (imagen que no es WebP, RIFF truncado, tamaño de chunk corrupto) devuelve
 * false y el llamador sigue por la ruta normal.
 */
export function isAnimatedWebP(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20) return false
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return false
  if (buffer.toString('ascii', 8, 12) !== 'WEBP') return false

  const end = Math.min(buffer.length, 8 + buffer.readUInt32LE(4))
  let hasANIM = false
  let hasANMF = false

  for (let offset = 12; offset + 8 <= end; ) {
    const fourcc = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)

    if (fourcc === 'ANIM') hasANIM = true
    else if (fourcc === 'ANMF') hasANMF = true
    if (hasANIM && hasANMF) return true

    // Los chunks del RIFF están alineados a 2 bytes. size 0 avanza 8 bytes,
    // así que el bucle siempre termina aunque el archivo esté corrupto.
    offset += 8 + size + (size % 2)
  }

  return false
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