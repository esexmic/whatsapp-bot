/**
 * Diagnostica el estado de la sesión de WhatsApp.
 *   npm run session
 */
import fs from 'fs'
import path from 'path'
import { SESSION_DIR } from '../src/lib/store.js'

const CREDS = path.join(SESSION_DIR, 'creds.json')

console.log('\n📱 Estado de la sesión\n' + '─'.repeat(50))
console.log(`Carpeta: ${SESSION_DIR}`)
console.log(`Existe:  ${fs.existsSync(SESSION_DIR) ? 'sí' : 'NO'}`)

if (!fs.existsSync(SESSION_DIR)) {
  console.log('\n❌ No hay carpeta de sesión. Ejecuta: npm run login\n')
  process.exit(1)
}

const files = fs.readdirSync(SESSION_DIR)
const signalKeys = files.filter((f) => f.startsWith('identity-key-') || f.startsWith('session-') || f.startsWith('pre-key-'))

console.log(`Archivos de señal: ${signalKeys.length}`)
console.log(`\n${fs.existsSync(CREDS) ? '✅' : '❌'} creds.json ${fs.existsSync(CREDS) ? 'presente' : 'AUSENTE'}`)

if (!fs.existsSync(CREDS)) {
  console.log('\n' + '─'.repeat(50))
  console.log('❌ SIN SESIÓN GUARDADA')
  console.log('')
  console.log('Esto es lo que hace que te pida el QR en cada arranque.')
  console.log('Las claves de señal sin creds.json = el login nunca se completó.')
  console.log('')
  console.log('Solución:')
  console.log('  1. npm run login')
  console.log('  2. Escanea el QR y ESPERA a ver "✅ Conectado"')
  console.log('  3. NO cierres la ventana hasta ver ese mensaje')
  console.log('  4. npm start')
  console.log('')
  console.log('Si ya lo hiciste y sigue igual, dime qué te imprime el paso 2.')
  process.exit(1)
}

try {
  const creds = JSON.parse(fs.readFileSync(CREDS, 'utf8'))
  console.log(`registered: ${creds.registered}`)
  console.log(`número:    ${creds.me?.id || '(sin perfil)'}`)
  console.log(`nombre:    ${creds.me?.name || '(sin nombre)'}`)

  if (creds.registered) {
    console.log(`\n✅ Sesión válida. Puedes arrancar con: npm start`)
  } else {
    console.log('\n⚠️ La sesión NO está registrada. Vuelve a hacer npm run login.')
  }

  const age = Date.now() - fs.statSync(CREDS).mtimeMs
  console.log(`\nÚltima escritura: hace ${Math.round(age / 1000)}s`)
} catch (e) {
  console.log(`\n❌ creds.json está CORRUPTO: ${e.message}`)
  console.log('   Borra la carpeta sessions/ y vuelve a hacer npm run login')
  process.exit(1)
}

console.log('')