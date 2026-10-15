import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { env } from '../config/env.js'

/**
 * El 515 (restartRequired en bucle) casi siempre viene de esto:
 * fetchLatestBaileysVersion() lee la versión de `master` en GitHub, que puede
 * apuntar a una versión que WhatsApp ya no acepta.
 *
 * Si te pasa, fija la versión:
 *   BAILEYS_VERSION=2.3000.1028694800
 * (sin prefijo "v", separados por puntos).
 */
export async function resolveVersion() {
  const pinned = env('BAILEYS_VERSION').replace(/^v/, '').trim()

  if (pinned) {
    const parsed = Object.fromEntries(
      pinned.split('.').slice(0, 3).map((n, i) => [['isLatest', 'major', 'minor', 'patch'][i], Number(n)])
    )
    if (Number.isFinite(parsed.major)) {
      console.log(`📌 Versión de Baileys fijada: ${pinned}`)
      return parsed
    }
  }

  try {
    const { version } = await fetchLatestBaileysVersion()
    return version
  } catch {
    console.warn('⚠️ No se pudo consultar la última versión, usando la de Baileys por defecto.')
    return undefined
  }
}