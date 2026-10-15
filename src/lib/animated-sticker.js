import { execFile } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import sharp from 'sharp'
import { FFMPEG } from './ytdlp.js'
import { addStickerMetadata } from './sticker-exif.js'

const execFileAsync = promisify(execFile)

export async function makeAnimatedSticker(input, { packname = 'bot', author = 'xyb', maxDuration = 10 } = {}) {
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