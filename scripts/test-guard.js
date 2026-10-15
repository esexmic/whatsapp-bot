/**
 * Test de integración del dispatcher: simula un socket de Baileys y verifica
 * que el flujo completo (serialize -> guard -> comando) se comporta bien.
 */
import assert from 'assert'
import { isOwner, isAdmin, isBanned, registerLidMapping } from '../src/lib/perms.js'
import { requireStaff, requireGroupStaff, senderOf } from '../src/lib/guard.js'

const OWNER = '16787062887@s.whatsapp.net'
const STRANGER = '529999999999@s.whatsapp.net'
const GROUP = '123456@g.us'

// El mismo owner, pero WhatsApp lo manda por su id de dispositivo (@lid).
const OWNER_LID = '20543633887454@lid'
const ADMIN_LID = '9998887776@lid'

let pass = 0
let fail = 0
const t = async (name, fn) => {
  try {
    await fn()
    pass++
    console.log('  ok  ' + name)
  } catch (e) {
    fail++
    console.log('  FAIL ' + name + ' -> ' + e.message)
  }
}

function makeSocket({ isGroupAdmin = false } = {}) {
  const sent = []
  return {
    sent,
    user: { id: '999@s.whatsapp.net' },
    sendMessage(jid, content, opts) {
      sent.push({ jid, content, opts })
      return Promise.resolve({})
    },
    groupMetadata() {
      return Promise.resolve({
        subject: 'Test',
        participants: [
          { id: OWNER, admin: 'superadmin' },
          { id: STRANGER, admin: isGroupAdmin ? 'admin' : null },
        ],
      })
    },
    react() {},
  }
}

const db = { data: { admins: [] }, config: {}, contacts: {} }

console.log('\n== requireStaff ==')
await t('owner pasa', async () => {
  const c = makeSocket()
  const ok = await requireStaff(c, { key: { participant: OWNER } }, db, { label: '.x' })
  assert.ok(ok)
  assert.equal(c.sent.length, 0, 'no debe responder si tiene permiso')
})
await t('extraOwner de _extraOwners pasa', async () => {
  global._extraOwners = ['521234567890']
  const c = makeSocket()
  const ok = await requireStaff(c, { key: { participant: '521234567890@s.whatsapp.net' } }, db)
  assert.ok(ok)
  global._extraOwners = []
})
await t('admin del bot pasa', async () => {
  db.data.admins = [STRANGER]
  const c = makeSocket()
  const ok = await requireStaff(c, { key: { participant: STRANGER } }, db)
  assert.ok(ok)
  db.data.admins = []
})
await t('desconocido recibe rechazo', async () => {
  const c = makeSocket()
  const ok = await requireStaff(c, { key: { participant: STRANGER } }, db, { label: '.join' })
  assert.ok(!ok)
  assert.equal(c.sent.length, 1)
  assert.match(c.sent[0].content.text, /\.join/)
})

console.log('\n== requireGroupStaff ==')
await t('owner no es admin del grupo pero igual pasa (owner manda)', async () => {
  const c = makeSocket({ isGroupAdmin: false })
  const ok = await requireGroupStaff(c, { key: { remoteJid: GROUP, participant: OWNER } }, db)
  assert.ok(ok)
})
await t('admin del bot que NO es admin del grupo recibe rechazo', async () => {
  db.data.admins = [STRANGER]
  const c = makeSocket({ isGroupAdmin: false })
  const ok = await requireGroupStaff(c, { key: { remoteJid: GROUP, participant: STRANGER } }, db)
  assert.ok(!ok)
  assert.match(c.sent[0].content.text, /admin del grupo/i)
  db.data.admins = []
})
await t('admin del bot que SI es admin del grupo pasa', async () => {
  db.data.admins = [STRANGER]
  const c = makeSocket({ isGroupAdmin: true })
  const ok = await requireGroupStaff(c, { key: { remoteJid: GROUP, participant: STRANGER } }, db)
  assert.ok(ok)
  db.data.admins = []
})
await t('en privado requireGroupStaff no pide admin de grupo', async () => {
  const c = makeSocket()
  const ok = await requireGroupStaff(c, { key: { remoteJid: OWNER } }, db)
  assert.ok(ok)
})

console.log('\n== owner lockout ==')
await t('isOwner sigue funcionando tras todos los cambios', () => assert.ok(isOwner('16787062887')))

console.log('\n== @lid: el owner que .roles lista pero los comandos rechazaban ==')
await t('sin mapeo, un @lid NO es owner (aun)', () => {
  assert.equal(isOwner(OWNER_LID), false)
})

await t('tras el mapeo, el owner por @lid pasa en grupo', () => {
  registerLidMapping(OWNER_LID, OWNER)
  const c = makeSocket()
  const ok = requireStaff(c, { key: { remoteJid: GROUP, participant: OWNER_LID } }, db)
  return ok.then((r) => assert.ok(r))
})

await t('tras el mapeo, el owner por @lid pasa en privado', () => {
  const c = makeSocket()
  const ok = requireStaff(c, { key: { remoteJid: OWNER_LID } }, db)
  return ok.then((r) => assert.ok(r))
})

await t('requireGroupStaff tambien acepta al owner por @lid', async () => {
  const c = makeSocket()
  assert.ok(await requireGroupStaff(c, { key: { remoteJid: GROUP, participant: OWNER_LID } }, db))
})

await t('un @lid desconocido NO se cuela como owner', () => {
  assert.equal(isOwner('1112223334@lid'), false)
  assert.equal(isOwner(''), false)
  assert.equal(isOwner(null), false)
})

await t('un admin del bot guardado por numero se reconoce por su @lid', () => {
  registerLidMapping(ADMIN_LID, '5215557202760@s.whatsapp.net')
  const withNumber = { data: { admins: ['5215557202760'] } }
  assert.equal(isAdmin('5215557202760@s.whatsapp.net', withNumber), true)
  assert.equal(isAdmin(ADMIN_LID, withNumber), true, 'el admin por @lid no se reconocio')
  assert.equal(isAdmin('1111111111@s.whatsapp.net', withNumber), false)
})

await t('un baneado sigue baneado aunque su mensaje llegue por su @lid', () => {
  registerLidMapping('8887776665@lid', '5215557202761@s.whatsapp.net')
  const banned = { data: { banned: ['5215557202761'] } }
  assert.equal(isBanned('5215557202761@s.whatsapp.net', banned), true)
  assert.equal(
    isBanned('8887776665@lid', banned),
    true,
    'el baneado se escapo por su @lid: seguridad rota'
  )
  assert.equal(isBanned('7776665554@lid', banned), false, 'LID sin mapear no debe banear de mas')
})

console.log('\n== remoteJidAlt / participantAlt: el numero viene en el mensaje ==')
await t('en privado, remoteJid @lid + remoteJidAlt numero -> owner', async () => {
  const c = makeSocket()
  const msg = { key: { remoteJid: OWNER_LID, remoteJidAlt: OWNER } }
  assert.equal(senderOf(msg), '16787062887', 'no se tomo el numero real del campo Alt')
  assert.ok(await requireStaff(c, msg, db))
})

await t('en grupo, participant @lid + participantAlt numero -> owner', async () => {
  const c = makeSocket()
  const msg = { key: { remoteJid: GROUP, participant: OWNER_LID, participantAlt: OWNER } }
  assert.equal(senderOf(msg), '16787062887')
  assert.ok(await requireStaff(c, msg, db))
})

await t('sin campos Alt se comporta como antes (numero directo)', () => {
  assert.equal(senderOf({ key: { remoteJid: OWNER } }), '16787062887')
  assert.equal(senderOf({ key: { remoteJid: GROUP, participant: OWNER } }), '16787062887')
})

await t('el campo Alt no abre la puerta a cualquiera', async () => {
  const c = makeSocket()
  const falso = { key: { remoteJid: '1111111111@lid', remoteJidAlt: '2222222222@s.whatsapp.net' } }
  assert.equal(isOwner(senderOf(falso)), false)
  assert.equal(await requireStaff(c, falso, db), false)
})

console.log(`\n${pass} pasaron, ${fail} fallaron\n`)
process.exit(fail > 0 ? 1 : 0)