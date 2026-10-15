import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Raíz del proyecto (src/lib -> src -> proyecto)
export const ROOT = path.resolve(__dirname, '..', '..')

export const DB_FILE = process.env.DB_FILE
  ? path.resolve(process.env.DB_FILE)
  : path.join(ROOT, 'database.json')

const TMP_FILE = `${DB_FILE}.tmp`
const BACKUP_FILE = `${DB_FILE}.bak`

/**
 * Carpeta de sesión de WhatsApp. Anclada a la raíz del proyecto, NO a
 * process.cwd(): si arrancas el bot desde otro directorio, antes buscaba la
 * sesión en otro sitio y parecía que "se perdía".
 */
export const SESSION_DIR = process.env.SESSION_DIR
  ? path.resolve(process.env.SESSION_DIR)
  : path.join(ROOT, 'sessions')

const DEFAULTS = {
  contacts: {},
  config: {
    prefix: '.',
    botName: 'CKV BOT',
    menuStyle: 'default',
    stickerPack: 'CKV',
    stickerAuthor: 'Bot',
    mode: 'public',
    welcome: {},
    goodbye: {},
    antilink: [],
    antispam: [],
  },
  data: {
    admins: [],
    muted: [],
    banned: [],
    autoresponder: {},
    afk: {},
    antivirgenes: [],
    extraOwners: [],
  },
}

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

/** Mergea un objeto parcial sobre la estructura por defecto (sin perder claves). */
function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base
  for (const key of Object.keys(patch)) {
    const val = patch[key]
    if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      deepMerge(base[key], val)
    } else if (val !== undefined) {
      base[key] = val
    }
  }
  return base
}

export function defaultDB() {
  return clone(DEFAULTS)
}

export function loadDB(db = defaultDB()) {
  if (!fs.existsSync(DB_FILE)) return db

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8')
    if (!raw.trim()) return db
    return deepMerge(db, JSON.parse(raw))
  } catch (err) {
    // Conserva el archivo roto para no perderlo y arranca con defaults.
    try {
      fs.copyFileSync(DB_FILE, BACKUP_FILE)
      console.error(`[store] database.json corrupto, respaldo en ${BACKUP_FILE}: ${err.message}`)
    } catch {}
    return db
  }
}

let timer = null
let pending = false

/** Escritura atómica: escribe a .tmp y renombra. Nunca deja el JSON a medias. */
function writeNow(db) {
  const obj = { contacts: db.contacts || {}, config: db.config || {}, data: db.data || {} }
  const payload = JSON.stringify(obj, null, 2)

  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
  fs.writeFileSync(TMP_FILE, payload, 'utf8')
  fs.renameSync(TMP_FILE, DB_FILE)
}

/** Guarda con debounce para no escribir en disco por cada mensaje. */
export function saveDB(db = global.db, { immediate = false } = {}) {
  if (!db) return
  if (immediate) {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    pending = false
    try {
      writeNow(db)
    } catch (err) {
      console.error('[store] error guardando:', err.message)
    }
    return
  }

  pending = true
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    if (!pending) return
    pending = false
    try {
      writeNow(db)
    } catch (err) {
      console.error('[store] error guardando:', err.message)
    }
  }, 1500)
  timer.unref?.()
}

export function flushDB() {
  saveDB(global.db, { immediate: true })
}