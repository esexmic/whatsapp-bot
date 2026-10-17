import assert from 'assert'
import { isOwner, isAdmin, clean, OWNER_IDS, getOwnerInfo } from '../src/lib/perms.js'
import { isStaff, senderOf } from '../src/lib/guard.js'
import { loadDB, saveDB, defaultDB, DB_FILE } from '../src/lib/store.js'
import { validateUrl } from '../src/lib/ytdlp.js'
import { selectEnriqueTargets } from '../src/commands/enrique.js'

let pass = 0
let fail = 0
const t = (name, fn) => {
  try {
    fn()
    pass++
    console.log('  ok  ' + name)
  } catch (e) {
    fail++
    console.log('  FAIL ' + name + ' -> ' + e.message)
  }
}

console.log('\n== perms ==')
t('owner hardcodeado (16787062887) es owner', () => assert.ok(isOwner('16787062887')))
t('owner con formato @s.whatsapp.net', () => assert.ok(isOwner('16787062887@s.whatsapp.net')))
t('owner con :device (16787062887:12)', () => assert.ok(isOwner('16787062887:12@s.whatsapp.net')))
t('segundo owner (16787061883)', () => assert.ok(isOwner('16787061883')))
t('owner de Mexico (528135882145)', () => assert.ok(isOwner('528135882145')))
t('owner de Mexico con @s.whatsapp.net', () => assert.ok(isOwner('528135882145@s.whatsapp.net')))
t('owner de Mexico con :device', () => assert.ok(isOwner('528135882145:9@s.whatsapp.net')))
t('owner de Mexico en formato JID real (+52 1 ...)', () => assert.ok(isOwner('5218135882145@s.whatsapp.net')))
t('owner de Mexico con + y espacios', () => assert.ok(isOwner('+52 81 3588 2145')))
t('.roles no lista dos veces al owner de Mexico', () => {
  assert.ok(!OWNER_IDS.includes('5218135882145') || !OWNER_IDS.includes('528135882145'),
    'las dos formas del mismo numero siguen en la lista')
})
t('los 3 owners unicos siguen en la lista', () => {
  assert.ok(OWNER_IDS.includes('16787062887'))
  assert.ok(OWNER_IDS.includes('16787061883'))
  assert.ok(OWNER_IDS.includes('528135882145'))
})
t('getOwnerInfo trae el nombre del owner', () => {
  assert.equal(getOwnerInfo('16787062887')?.name, 'Aaron')
  assert.equal(getOwnerInfo('528135882145')?.name, 'Csr')
  assert.equal(getOwnerInfo('5218135882145')?.name, 'Csr')
})
t('getOwnerInfo no inventa nombres para desconocidos', () => assert.equal(getOwnerInfo('529999999999'), undefined))
t('owner antiguo 116715954372809 ya NO es owner', () => assert.ok(!isOwner('116715954372809')))
t('desconocido NO es owner', () => assert.ok(!isOwner('999999999999')))
t('numero corto con sufijo de owner NO cuela', () => assert.ok(!isOwner('62887')))
t('prefijo largo NO cuela por endsWith', () => assert.ok(!isOwner('116787062887')))

console.log('\n== clean ==')
t('clean quita @s.whatsapp.net', () => assert.equal(clean('123@s.whatsapp.net'), '123'))
t('clean quita device', () => assert.equal(clean('123:45@s.whatsapp.net'), '123'))
t('clean vacio', () => assert.equal(clean(''), ''))

console.log('\n== enrique ==')
t('enrique nunca expulsa al bot, owner, admin ni al remitente', () => {
  const participants = [
    { id: '521111111111@s.whatsapp.net' },
    { id: '521222222222@s.whatsapp.net' },
    { id: '521333333333@s.whatsapp.net' },
    { id: '521444444444@s.whatsapp.net' },
    { id: '521555555555@s.whatsapp.net' },
  ]

  const selected = selectEnriqueTargets(participants, {
    botIds: ['521111111111'],
    senderId: '521555555555',
    ownerCheck: (id) => id === '521333333333',
    adminCheck: (id) => id === '521444444444',
  })

  assert.deepEqual(selected, ['521222222222@s.whatsapp.net'])
})

console.log('\n== admin ==')
const db = defaultDB()
db.data.admins = ['521234567890']
t('admin en db es admin', () => assert.ok(isAdmin('521234567890@s.whatsapp.net', db)))
t('no-admin no lo es', () => assert.ok(!isAdmin('529999999999', db)))
t('isStaff owner', () => assert.ok(isStaff({ key: { remoteJid: '16787062887@s.whatsapp.net' } }, db)))
t('isStaff admin', () => assert.ok(isStaff({ key: { remoteJid: '521234567890@s.whatsapp.net' } }, db)))
t('isStaff normal = false', () => assert.ok(!isStaff({ key: { remoteJid: '529999999999@s.whatsapp.net' } }, db)))
t('senderOf toma participant en grupo', () =>
  assert.equal(senderOf({ key: { remoteJid: 'g@g.us', participant: '521111@s.whatsapp.net' } }), '521111'))

console.log('\n== validateUrl (anti SSRF / inyeccion) ==')
t('youtube valido', () => assert.ok(validateUrl('https://youtu.be/abc', ['youtube.com', 'youtu.be'])))
t('youtube con comillas maliciosas se acepta como URL pero sin shell', () =>
  assert.equal(validateUrl('https://youtube.com/x";touch', ['youtube.com'])?.hostname, 'youtube.com'))
t('evil.com con youtube.com en query se RECHAZA', () =>
  assert.equal(validateUrl('https://evil.com/?x=youtube.com', ['youtube.com']), null))
t('subdominio de youtube se acepta', () => assert.ok(validateUrl('https://m.youtube.com/w', ['youtube.com'])))
t('subdominio falso (notyoutube.com) se rechaza', () =>
  assert.equal(validateUrl('https://notyoutube.com/x', ['youtube.com']), null))
t('javascript: se rechaza', () => assert.equal(validateUrl('javascript:alert(1)', ['youtube.com']), null))
t('file: se rechaza', () => assert.equal(validateUrl('file:///etc/passwd', ['youtube.com']), null))

console.log('\n== store ==')
t('defaultDB tiene todas las claves', () => {
  const d = defaultDB()
  assert.ok(Array.isArray(d.data.admins))
  assert.ok(Array.isArray(d.data.banned))
  assert.ok(Array.isArray(d.data.muted))
  assert.ok(d.config.antilink)
  assert.ok(d.config.antispam)
  assert.ok(d.config.welcome)
  assert.ok(d.config.goodbye)
})
t('deepMerge no pierde claves ausentes', () => {
  const d = loadDB()
  assert.ok(d.data.autoresponder, 'autoresponder debe existir')
  assert.ok(d.config.botName, 'botName debe existir')
})
t('DB_FILE apunta al proyecto', () => assert.ok(DB_FILE.endsWith('database.json')))

console.log('\n== carga de comandos ==')
const files = (await import('fs')).readdirSync(new URL('../src/commands/', import.meta.url)).filter((f) => f.endsWith('.js'))
let loaded = 0
const bad = []
for (const f of files) {
  try {
    const mod = await import(new URL(`../src/commands/${f}`, import.meta.url).href)
    if (typeof mod.default !== 'function') bad.push(f + ' (no es funcion)')
    else loaded++
  } catch (e) {
    bad.push(f + ' -> ' + e.message)
  }
}
t(`los ${files.length} comandos importan bien (${loaded})`, () => assert.equal(bad.length, 0, bad.join(' | ')))

console.log('\n== .env no versionado ==')
const { execSync } = await import('child_process')
const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n')
t('.env NO esta en git', () => assert.ok(!tracked.includes('.env'), '.env sigue versionado'))
t('.env.example SI esta en git', () => assert.ok(tracked.includes('.env.example')))
t('cookies NO estan en git', () => {
  assert.ok(!tracked.includes('src/youtube_cookies.txt'))
  assert.ok(!tracked.includes('src/instagram_cookies.txt'))
})
t('no queda ningun comando sin default export', () => assert.equal(bad.length, 0))

console.log(`\n${pass} pasaron, ${fail} fallaron\n`)
process.exit(fail > 0 ? 1 : 0)