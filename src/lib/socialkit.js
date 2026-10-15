import { env } from '../config/env.js'

const BASE = 'https://api.socialkit.dev'
const KEY = env('SOCIALKIT_KEY')

const ENDPOINTS = {
  tiktok: ['/tiktok/download', '/tiktok', '/api/tiktok/download', '/api/tiktok'],
  instagram: ['/instagram/download', '/instagram', '/api/instagram/download', '/api/instagram'],
}

export async function socialkitDownload(platform, url) {
  if (!KEY) return null
  for (const p of ENDPOINTS[platform] || [`/${platform}/download`]) {
    try {
      const res = await fetch(`${BASE}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_key: KEY, url }),
        signal: AbortSignal.timeout(15000)
      })
      if (!res.ok) continue
      const body = await res.json()
      const d = body?.data ?? body
      if (!d) continue
      const r = {
        downloadUrl: d.downloadUrl || d.download_url || d.url || d.video || d.play || '',
        images: d.images || d.image_urls || [],
        music: d.music || d.audio || d.musicUrl || '',
      }
      if (r.downloadUrl || r.images.length) return r
    } catch {}
  }
  return null
}
