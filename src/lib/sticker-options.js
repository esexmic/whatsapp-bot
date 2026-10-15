export function parseStickerOptions(args, defaults = {}) {
  const fallbackPack = defaults.packname || 'bot'
  const fallbackAuthor = defaults.author || ''
  const text = Array.isArray(args) ? args.join(' ').trim() : ''
  if (!text) return { packname: fallbackPack, author: fallbackAuthor }

  const separatorIndex = text.search(/[|/]/)
  if (separatorIndex < 0) return { packname: text, author: fallbackAuthor }

  return {
    packname: text.slice(0, separatorIndex).trim() || fallbackPack,
    author: text.slice(separatorIndex + 1).trim() || fallbackAuthor,
  }
}