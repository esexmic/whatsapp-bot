import qrTerminal from 'qrcode-terminal'
import qrcode from 'qrcode'
import fs from 'fs'
import path from 'path'

/**
 * Muestra el QR en la terminal y lo guarda como PNG.
 *
 * OJO: en qrcode@1.5.4 la firma es toFile(archivo, texto, opts), con los
 * argumentos al revés respecto a v2. No cambiar el orden.
 */
export function printQR(payload, { file = 'qr.png', label = true, terminal = true, imageUrl = null } = {}) {
  const url = payload.startsWith('wa.me') ? `https://${payload}` : payload

  if (terminal && label) {
    console.log('')
    console.log('╔══════════════════════════════════════════╗')
    console.log('║   📱 ESCANEA ESTE QR DESDE TU CELULAR   ║')
    console.log('╚══════════════════════════════════════════╝')
    console.log('')
  }

  if (terminal) {
    try {
      qrTerminal.generate(url, { small: true })
    } catch (e) {
      console.error('[qr] no se pudo imprimir en la terminal:', e.message)
    }
  }

  const qrPath = path.resolve(process.cwd(), file)
  qrcode
    .toFile(qrPath, url, { width: 600, margin: 2 })
    .then(() => {
      console.log(`🖼️  QR guardado en: ${qrPath}`)
      if (imageUrl) {
        console.log(`🔗 Abre este enlace para ver el QR como imagen: ${imageUrl}`)
      } else {
        console.log('🔗 Link (alternativa si no se escanea la terminal):')
        console.log(url)
        console.log('    Ábrelo con doble click o desde el celular.')
      }
      console.log('')
    })
    .catch((e) => console.error('[qr] no se pudo guardar el PNG:', e.message))

  return qrPath
}

export function removeQR(file = 'qr.png') {
  try {
    fs.rmSync(path.resolve(process.cwd(), file), { force: true })
  } catch {}
}