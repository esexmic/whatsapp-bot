import assert from 'assert'
import { socialkitDownload } from '../src/lib/socialkit.js'

let pass = 0
let fail = 0

async function test(name, fn) {
  try {
    await fn()
    pass++
    console.log(`  ok  ${name}`)
  } catch (error) {
    fail++
    console.log(`  FAIL ${name} -> ${error.message}`)
  }
}

console.log('\n== SocialKit TikTok v2 ==')

await test('usa GET v2 con url, access_key y calidad 720p', async () => {
  let requestedUrl
  let requestedOptions
  const result = await socialkitDownload(
    'tiktok',
    'https://tiktok.com/@demo/video/123',
    {
      apiKey: 'test-key',
      fetchImpl: async (url, options) => {
        requestedUrl = new URL(url)
        requestedOptions = options
        return new Response(JSON.stringify({ data: { video: 'https://cdn.test/video.mp4' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    }
  )

  assert.equal(requestedOptions.method, 'GET')
  assert.equal(requestedUrl.pathname, '/v2/tiktok/download')
  assert.equal(requestedUrl.searchParams.get('access_key'), 'test-key')
  assert.equal(requestedUrl.searchParams.get('url'), 'https://tiktok.com/@demo/video/123')
  assert.equal(requestedUrl.searchParams.get('quality'), '720p')
  assert.deepEqual(result, {
    downloadUrl: 'https://cdn.test/video.mp4',
    images: [],
    music: '',
  })
})

await test('acepta calidad configurable y normaliza carrusel', async () => {
  let requestedUrl
  const result = await socialkitDownload('tiktok', 'https://tiktok.com/video/456', {
    quality: '1080p',
    apiKey: 'test-key',
    fetchImpl: async (url) => {
      requestedUrl = new URL(url)
      return new Response(JSON.stringify({ data: { images: ['https://cdn.test/1.jpg'] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  assert.equal(requestedUrl.searchParams.get('quality'), '1080p')
  assert.deepEqual(result.images, ['https://cdn.test/1.jpg'])
})

await test('si v2 falla, conserva fallback POST legacy', async () => {
  const calls = []
  const result = await socialkitDownload('tiktok', 'https://tiktok.com/video/789', {
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), method: options.method })
      if (calls.length === 1) return new Response('', { status: 503 })
      return new Response(JSON.stringify({ data: { download_url: 'https://cdn.test/legacy.mp4' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[1].method, 'POST')
  assert.equal(result.downloadUrl, 'https://cdn.test/legacy.mp4')
})

await test('Instagram conserva su endpoint POST legacy', async () => {
  let requestedUrl
  let requestedOptions
  const result = await socialkitDownload('instagram', 'https://instagram.com/p/demo', {
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      requestedUrl = String(url)
      requestedOptions = options
      return new Response(JSON.stringify({ data: { images: ['https://cdn.test/post.jpg'] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  assert.equal(requestedUrl, 'https://api.socialkit.dev/instagram/download')
  assert.equal(requestedOptions.method, 'POST')
  assert.deepEqual(result.images, ['https://cdn.test/post.jpg'])
})

await test('no consulta la API sin clave', async () => {
  let called = false
  const result = await socialkitDownload('tiktok', 'https://tiktok.com/video/1', {
    apiKey: '',
    fetchImpl: async () => {
      called = true
      return new Response('{}')
    },
  })

  assert.equal(result, null)
  assert.equal(called, false)
})

console.log(`\n${pass} pasaron, ${fail} fallaron\n`)
process.exit(fail > 0 ? 1 : 0)