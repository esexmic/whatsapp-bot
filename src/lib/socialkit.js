import { env } from '../config/env.js'

const BASE = 'https://api.socialkit.dev'
const KEY = env('SOCIALKIT_KEY')

const ENDPOINTS = {
  tiktok: ['/tiktok/download', '/tiktok', '/api/tiktok/download', '/api/tiktok'],
  instagram: ['/instagram/download', '/instagram', '/api/instagram/download', '/api/instagram'],
}

const toUrl = (value) => {
  if (typeof value === 'string') return value
  return value?.url || value?.downloadUrl || value?.download_url || ''
}

function normalizeResponse(body) {
  const data = body?.data?.data ?? body?.data ?? body
  if (!data || typeof data !== 'object') return null

  const imagesValue = data.images || data.image_urls || data.imageUrls || []
  const images = (Array.isArray(imagesValue) ? imagesValue : [imagesValue])
    .map(toUrl)
    .filter(Boolean)

  const result = {
    downloadUrl:
      toUrl(data.downloadUrl) ||
      toUrl(data.download_url) ||
      toUrl(data.url) ||
      toUrl(data.videoUrl) ||
      toUrl(data.video_url) ||
      toUrl(data.video) ||
      toUrl(data.play),
    images,
    music: toUrl(data.music) || toUrl(data.audio) || toUrl(data.musicUrl),
  }

  return result.downloadUrl || result.images.length ? result : null
}

export async function socialkitDownload(
  platform,
  url,
  { quality = '720p', apiKey = KEY, fetchImpl = fetch } = {}
) {
  if (!apiKey || !url) return null

  const legacyPaths = ENDPOINTS[platform] || [`/${platform}/download`]
  const requests = []

  if (platform === 'tiktok') {
    const endpoint = new URL(`${BASE}/v2/tiktok/download`)
    endpoint.searchParams.set('access_key', apiKey)
    endpoint.searchParams.set('url', url)
    endpoint.searchParams.set('quality', quality)
    requests.push({ url: endpoint, method: 'GET' })
  }

  requests.push(
    ...legacyPaths.map((path) => ({
      url: `${BASE}${path}`,
      method: 'POST',
      body: JSON.stringify({ access_key: apiKey, url }),
    }))
  )

  for (const request of requests) {
    try {
      const res = await fetchImpl(request.url, {
        method: request.method,
        ...(request.body
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: request.body,
            }
          : {}),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const result = normalizeResponse(await res.json())
      if (result) return result
    } catch {}
  }
  return null
}
