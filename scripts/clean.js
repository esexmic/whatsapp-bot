/**
 * Limpia todo lo que pueda estar frenando el arranque:
 * procesos node de este proyecto, sesiones de WhatsApp, QR, puertos ocupados.
 *
 *   npm run clean          # solo muestra qué haría
 *   npm run clean -- --yes # lo ejecuta
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const APPLY = process.argv.includes('--yes') || process.argv.includes('-y')

const TARGETS = [
  { name: 'Sesiones de WhatsApp', path: path.join(ROOT, 'sessions') },
  { name: 'QR generado', path: path.join(ROOT, 'qr.png') },
  { name: 'QR temporal', path: path.join(ROOT, 'database.json.tmp') },
  { name: 'Respaldos de base de datos', match: /\.bak$/, in: ROOT },
  { name: 'Temporales', path: path.join(ROOT, 'temp') },
]

const PORTS = [3000]

console.log('\n🧹 Limpieza del bot\n' + '─'.repeat(46))

const found = []
for (const t of TARGETS) {
  if (t.path && fs.existsSync(t.path)) {
    found.push(t)
  } else if (t.match) {
    const hits = fs.readdirSync(ROOT).filter((f) => t.match.test(f))
    if (hits.length) found.push({ name: t.name, hits })
  }
}

if (found.length === 0) {
  console.log('✅ No hay nada que limpiar.')
} else {
  for (const f of found) {
    console.log(`  • ${f.name}${f.hits ? ': ' + f.hits.join(', ') : ''}`)
  }
}

console.log('\n🔌 Puertos')
let portBusy = false
for (const p of PORTS) {
  try {
    const out = execSync(`netstat -ano | findstr :${p}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    // Un mismo PID puede tener IPv4 e IPv6: se deduplica.
    const pids = [
      ...new Set(
        out
          .split('\n')
          .filter((l) => l.includes('LISTENING'))
          .map((l) => l.trim().split(/\s+/).pop())
          .filter(Boolean)
      ),
    ]
    if (pids.length) {
      portBusy = true
      console.log(`  • Puerto ${p} OCUPADO`)
      for (const pid of pids) {
        console.log(`      PID ${pid}`)
        if (APPLY) {
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: ['ignore', 'pipe', 'pipe'] })
            console.log('      → proceso terminado')
          } catch (e) {
            const msg = String(e.stderr || e.message || '')
            if (/Acceso denegado|denied/i.test(msg)) {
              console.log('      → ACCESO DENEGADO')
              console.log('        Ese proceso lo abriste tú en otra terminal.')
              console.log('        Ve a esa ventana y pulsa Ctrl+C para detenerlo.')
            } else {
              console.log('      → no se pudo terminar')
            }
          }
        }
      }
    } else {
      console.log(`  • Puerto ${p} libre`)
    }
  } catch {
    console.log(`  • Puerto ${p} libre`)
  }
}

if (!APPLY) {
  console.log('\n⚠️  Nada se modificó. Usa: npm run clean -- --yes\n')
  process.exit(0)
}

console.log('\n🗑️  Eliminando')
for (const f of found) {
  try {
    if (f.path) fs.rmSync(f.path, { recursive: true, force: true })
    else for (const h of f.hits) fs.rmSync(path.join(ROOT, h), { force: true })
    console.log(`  ✓ ${f.name}`)
  } catch (e) {
    console.log(`  ✗ ${f.name}: ${e.message}`)
  }
}

console.log(`\n✅ Listo${portBusy ? '' : ''}. Ahora: npm run login\n`)