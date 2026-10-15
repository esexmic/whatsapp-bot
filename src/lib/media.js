import { downloadContentFromMessage } from '@whiskeysockets/baileys'

const MEDIA_FIELDS = [
  ['imageMessage', 'image'],
  ['videoMessage', 'video'],
  ['stickerMessage', 'sticker'],
]

const MEDIA_TYPES = new Set(['audio', 'document', 'gif', 'image', 'ptt', 'sticker', 'video', 'ptv'])

export function findMedia(message) {
  for (const [field, type] of MEDIA_FIELDS) {
    if (message?.[field]) return { content: message[field], type }
  }
  return null
}

export async function downloadMediaBuffer(message, mediaType, downloader = downloadContentFromMessage) {
  if (!MEDIA_TYPES.has(mediaType)) {
    throw new TypeError(`Tipo de medio de WhatsApp no válido: ${mediaType}`)
  }

  const stream = await downloader(message, mediaType)
  if (Buffer.isBuffer(stream)) return stream

  const chunks = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}