import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from './firebase.js'
import { resolveWorkflow } from './workflow.js'

export const TICKETS = 'tickets'
export const LOGS = 'systemLogs'

export async function createTicket(ticket, actor) {
  if (!db) throw new Error('Firebase is not configured.')
  const workflow = resolveWorkflow(ticket)
  const payload = { ...ticket, workflowId: workflow.id, workflowSteps: workflow.steps, currentModule: workflow.steps[0], currentStatus: workflow.steps[0] === 'logistics' ? 'logistics_pending' : 'pending_warehouse', createdBy: actor?.uid || '', createdByName: actor?.name || actor?.email || '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
  const ref = await addDoc(collection(db, TICKETS), payload)
  await writeLog({ action: 'ticket_created', ticketId: ref.id, details: `${ticket.ticketType} ticket created`, actor })
  return ref.id
}

export function subscribeTickets(callback) {
  if (!db) return () => {}
  return onSnapshot(query(collection(db, TICKETS), orderBy('createdAt', 'desc')), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

export async function updateTicket(id, changes, actor, action = 'ticket_updated') {
  if (!db) throw new Error('Firebase is not configured.')
  await updateDoc(doc(db, TICKETS, id), { ...changes, updatedAt: serverTimestamp() })
  await writeLog({ action, ticketId: id, details: JSON.stringify(changes), actor })
}

export async function writeLog({ action, ticketId = '', details = '', actor }) {
  if (!db) return
  await addDoc(collection(db, LOGS), { action, ticketId, details, userId: actor?.uid || '', userName: actor?.name || actor?.email || '', role: actor?.role || '', createdAt: serverTimestamp() })
}

export function subscribeLogs(callback) {
  if (!db) return () => {}
  return onSnapshot(query(collection(db, LOGS), orderBy('createdAt', 'desc'), limit(100)), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}
