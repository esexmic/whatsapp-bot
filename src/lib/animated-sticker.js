import { execFile } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import sharp from 'sharp'
import webpmux from 'node-webpmux'
import { FFMPEG } from './ytdlp.js'

const execFileAsync = promisify(execFile)
const { Image } = webpmux

export async function addStickerMetadata(webpBuffer, { packname = 'bot', author = '' } = {}) {
  const cleanText = (value) => String(value || '').replace(/[\u0000-\u001f]/g, '').slice(0, 100)
  const exifCarrier = await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .webp()
    .withExif({
      IFD0: {
        Copyright: cleanText(author),
        Artist: cleanText(author),
        ImageDescription: cleanText(packname),
        Software: 'CKV BOT',
      },
    })
    .toBuffer()
  const exif = (await sharp(exifCarrier).metadata()).exif
  if (!exif) throw new Error('No se pudo generar metadata EXIF para el sticker')

  const image = new Image()
  await image.load(webpBuffer)
  image.exif = exif
  return image.save(null)
}

export async function makeAnimatedSticker(input, { packname = 'bot', author = '', maxDuration = 10 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'animated-sticker-'))
  const inputPath = join(dir, 'input.mp4')
  const outputPath = join(dir, 'output.webp')

  try {
    writeFileSync(inputPath, input)
    await execFileAsync(
      FFMPEG,
      [
        '-y',
        '-i', inputPath,
        '-t', String(maxDuration),
        '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=15',
        '-loop', '0',
        '-an',
        outputPath,
      ],
      { timeout: 30000 }
    )

    if (!existsSync(outputPath)) throw new Error('ffmpeg no generó el sticker')
    return await addStickerMetadata(readFileSync(outputPath), { packname, author })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}