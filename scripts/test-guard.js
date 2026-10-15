/**
 * Test de integración del dispatcher: simula un socket de Baileys y verifica
 * que el flujo completo (serialize -> guard -> comando) se comporta bien.
 */
import assert from 'assert'
import { isOwner } from '../src/lib/perms.js'
import { requireStaff, requireGroupStaff } from '../src/lib/guard.js'

const OWNER = '16787062887@s.whatsapp.net'
const STRANGER = '529999999999@s.whatsapp.net'
const GROUP = '123456@g.us'

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

console.log(`\n${pass} pasaron, ${fail} fallaron\n`)
process.exit(fail > 0 ? 1 : 0)