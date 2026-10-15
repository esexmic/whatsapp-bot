import sharp from 'sharp'
import { addStickerMetadata } from './sticker-exif.js'

/**
 * Generador de stickers de WhatsApp.
 *
 * wa-sticker-formatter@4.4.4 está abandonado (2022) y sus binarios nativos
 * fallan con "bad decrypt" / "corrupt header" al procesar cualquier imagen.
 * Esto lo reemplaza con sharp, que sí funciona.
 *
 * WhatsApp lee el pack y el autor de los tags EXIF del WebP:
 *   Description -> pack
 *   awb / Artist -> autor
 */

const MAX = 512

/** Convierte cualquier entrada (Buffer/stream/base64/URL) a Buffer. */
export async function toBuffer(input) {
  if (!input) throw new Error('No hay imagen')
  if (Buffer.isBuffer(input)) return input

  if (typeof input === 'string') {
    if (/^https?:\/\//i.test(input)) {
      const res = await fetch(input, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`)
      return Buffer.from(await res.arrayBuffer())
    }
    return Buffer.from(input, 'base64')
  }

  if (input?.pipe) {
    const chunks = []
    for await (const c of input) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
    return Buffer.concat(chunks)
  }

  if (input?.arrayBuffer) return Buffer.from(await input.arrayBuffer())

  if (input?.buffer) return input.buffer

  throw new Error('Entrada de imagen no reconocida')
}

/**
 * Convierte una imagen en sticker WebP de WhatsApp (512x512).
 * @param {Buffer|string} input imagen original
 * @param {{packname?:string, author?:string, quality?:number}} opts
 */
export async function makeSticker(input, { packname = 'bot', author = 'xyb', quality = 90 } = {}) {
  const buffer = await toBuffer(input)

  const image = sharp(buffer, { failOn: 'none', animated: false })
    .rotate() // respeta EXIF de orientación
    .resize(MAX, MAX, {
      fit: 'cover',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({
      quality: Math.min(100, Math.max(1, quality)),
      effort: 4,
    })

  const webpBuffer = await image.toBuffer()
  return addStickerMetadata(webpBuffer, { packname, author })
}

/** Sticker con texto encima (para .globo y similares). */
export async function makeStickerWithText(input, text, opts = {}) {
  const buffer = await toBuffer(input)

  // sharp -> raw RGBA -> canvas
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(MAX, MAX, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { createCanvas } = await import('@napi-rs/canvas')
  const canvas = createCanvas(info.width, info.height)
  const ctx = canvas.getContext('2d')

  const imageData = ctx.createImageData(info.width, info.height)
  imageData.data.set(data)
  ctx.putImageData(imageData, 0, 0)

  if (text) {
    const label = String(text)
    const size = Math.max(24, Math.min(96, Math.round(MAX / Math.max(6, label.length * 0.6))))
    ctx.font = `bold ${size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = Math.max(2, Math.round(size / 10))
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'
    ctx.strokeText(label, MAX / 2, MAX / 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, MAX / 2, MAX / 2)
  }

  const out = await canvas.encode('webp', opts.quality ?? 90)
  return Buffer.from(out)
}

export default makeSticker