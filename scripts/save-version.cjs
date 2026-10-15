const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

try {
  const hash = execSync('git log -1 --format="%H"', { encoding: 'utf8', timeout: 5000 }).trim()
  const msg = execSync('git log -1 --format="%s"', { encoding: 'utf8', timeout: 5000 }).trim()
  const date = execSync('git log -1 --format="%ai"', { encoding: 'utf8', timeout: 5000 }).trim()
  fs.writeFileSync(path.join(__dirname, '..', 'version.json'), JSON.stringify({ hash, msg, date }, null, 2))
} catch (e) {
  // git not available, skip
}
