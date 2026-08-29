import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore'

import { db } from './firebase.js'

import {
  resolveWorkflow,
  getInitialStatus,
  getNextStatus
} from './workflow.js'

export const TICKETS = 'tickets'
export const LOGS = 'systemLogs'

/*
 * Create a new ticket and resolve its workflow.
 */
export async function createTicket(
  ticket,
  actor
) {
  if (!db) {
    throw new Error(
      'Firebase is not configured.'
    )
  }

  if (!ticket?.ticketType) {
    throw new Error(
      'Ticket type is required.'
    )
  }

  if (!ticket?.ticketId) {
    throw new Error(
      'Ticket ID is required.'
    )
  }

  const workflow =
    resolveWorkflow(ticket)

  const initialStatus =
    getInitialStatus(ticket)

  /*
   * A ticket without a configured workflow
   * must not silently enter an operational queue.
   */
  if (!workflow.steps.length) {
    throw new Error(
      'No workflow is configured for this ticket. Please check the ticket type, source and destination company.'
    )
  }

  const payload = {
    ...ticket,

    /*
     * Workflow metadata
     */
    workflowId:
      workflow.id,

    workflowSteps:
      workflow.steps,

    workflowName:
      workflow.ruleName,

    currentStatus:
      initialStatus,

    /*
     * Current module is derived from the
     * current operational status.
     */
    currentModule:
      getModuleFromStatus(
        initialStatus
      ),

    /*
     * Operational metadata
     */
    createdBy:
      actor?.uid || '',

    createdByName:
      actor?.name ||
      actor?.email ||
      '',

    createdByRole:
      actor?.role ||
      '',

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),

    lastActionAt:
      serverTimestamp()
  }

  const ref = doc(collection(db, TICKETS))
  const logRef = doc(collection(db, LOGS))
  const batch = writeBatch(db)

  batch.set(ref, payload)
  batch.set(logRef, buildLog({
    action: 'ticket_created',
    ticketId: ref.id,
    module: 'crm',
    previousStatus: '',
    newStatus: initialStatus,
    details:
      `${ticket.ticketType} ticket ${ticket.ticketId} created using workflow "${workflow.ruleName}". Initial status: ${initialStatus}.`,
    actor
  }))
  await batch.commit()

  return ref.id
}

/*
 * Subscribe to all tickets in newest-first order.
 */
export function subscribeTickets(
  callback,
  onError
) {
  if (!db) {
    return () => {}
  }

  const ticketsQuery = query(
    collection(db, TICKETS),
    orderBy(
      'createdAt',
      'desc'
    )
  )

  return onSnapshot(
    ticketsQuery,
    (snap) => {
      const tickets =
        snap.docs.map(
          (ticketDoc) => ({
            id: ticketDoc.id,
            ...ticketDoc.data()
          })
        )

      callback(tickets)
    },
    (error) => {
      console.error(
        'Ticket subscription error:',
        error
      )

      if (onError) {
        onError(error)
      }
    }
  )
}

/*
 * Update an existing ticket.
 */
export async function updateTicket(
  id,
  changes,
  actor,
  action = 'ticket_updated',
  activity = {}
) {
  if (!db) {
    throw new Error(
      'Firebase is not configured.'
    )
  }

  if (!id) {
    throw new Error(
      'Ticket ID is required.'
    )
  }

  const batch = writeBatch(db)
  batch.update(doc(db, TICKETS, id), {
    ...changes,
    ...(changes.currentStatus ? { statusChangedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
    lastActionAt: serverTimestamp(),
    lastActionBy: actor?.uid || '',
    lastActionByName: actor?.name || actor?.email || '',
    lastActionByRole: actor?.role || ''
  })
  batch.set(doc(collection(db, LOGS)), buildLog({
    action,
    ticketId: id,
    module: activity.module || actor?.role || '',
    previousStatus: activity.previousStatus ?? changes.previousStatus ?? '',
    newStatus: activity.newStatus ?? changes.currentStatus ?? '',
    details: activity.details || JSON.stringify(changes),
    actor,
    metadata: activity.metadata || {}
  }))
  await batch.commit()
}

/*
 * Move a ticket to its next configured
 * workflow status.
 */
export async function advanceTicket(
  ticket,
  actor,
  extraChanges = {},
  action = 'ticket_advanced'
) {
  if (!ticket?.id) {
    throw new Error(
      'Ticket ID is required.'
    )
  }

  const nextStatus =
    getNextStatus(ticket)

  if (!nextStatus) {
    throw new Error(
      'No next workflow step is available for this ticket.'
    )
  }

  const changes = {
    ...extraChanges,

    currentStatus:
      nextStatus,

    currentModule:
      getModuleFromStatus(
        nextStatus
      ),

    previousStatus:
      ticket.currentStatus || '',

    statusChangedAt:
      serverTimestamp()
  }

  await updateTicket(
    ticket.id,
    changes,
    actor,
    action
  )

  return nextStatus
}

/*
 * Explicitly move a ticket to a selected
 * workflow status.
 */
export async function moveTicketToStatus(
  ticket,
  status,
  actor,
  extraChanges = {},
  action = 'ticket_status_changed'
) {
  if (!ticket?.id) {
    throw new Error(
      'Ticket ID is required.'
    )
  }

  if (!status) {
    throw new Error(
      'Target status is required.'
    )
  }

  if (
    Array.isArray(
      ticket.workflowSteps
    ) &&
    ticket.workflowSteps.length > 0 &&
    !ticket.workflowSteps.includes(
      status
    )
  ) {
    throw new Error(
      'The selected status is not part of this ticket workflow.'
    )
  }

  const changes = {
    ...extraChanges,

    currentStatus:
      status,

    currentModule:
      getModuleFromStatus(
        status
      ),

    previousStatus:
      ticket.currentStatus || '',

    statusChangedAt:
      serverTimestamp()
  }

  await updateTicket(
    ticket.id,
    changes,
    actor,
    action
  )
}

/*
 * Write an immutable system audit log.
 */
export async function writeLog({
  action,
  ticketId = '',
  details = '',
  actor,
  module = '',
  previousStatus = '',
  newStatus = '',
  metadata = {}
}) {
  if (!db) {
    return
  }

  await addDoc(collection(db, LOGS), buildLog({ action, ticketId, details, actor, module, previousStatus, newStatus, metadata }))
}

function buildLog({ action, ticketId = '', details = '', actor, module = '', previousStatus = '', newStatus = '', metadata = {} }) {
  return {
    action,
    ticketId,
    module,
    previousStatus,
    newStatus,
    details,
    metadata,
    userId: actor?.uid || '',
    userName: actor?.name || actor?.email || '',
    role: actor?.role || '',
    createdAt: serverTimestamp()
  }
}

/* Ticket-specific activity is sorted client-side, so this query needs no composite Firestore index. */
export function subscribeTicketActivity(ticketId, callback, onError) {
  if (!db || !ticketId) return () => {}
  return onSnapshot(query(collection(db, LOGS), where('ticketId', '==', ticketId)), (snap) => {
    callback(snap.docs.map(logDoc => ({ id: logDoc.id, ...logDoc.data() })).sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt)))
  }, onError)
}

function timestampValue(value) {
  return value?.toMillis ? value.toMillis() : 0
}

/*
 * Subscribe to the latest system logs.
 */
export function subscribeLogs(
  callback,
  onError
) {
  if (!db) {
    return () => {}
  }

  const logsQuery = query(
    collection(
      db,
      LOGS
    ),
    orderBy(
      'createdAt',
      'desc'
    ),
    limit(100)
  )

  return onSnapshot(
    logsQuery,
    (snap) => {
      const logs =
        snap.docs.map(
          (logDoc) => ({
            id: logDoc.id,
            ...logDoc.data()
          })
        )

      callback(logs)
    },
    (error) => {
      console.error(
        'System log subscription error:',
        error
      )

      if (onError) {
        onError(error)
      }
    }
  )
}

/*
 * Convert workflow statuses into the
 * module responsible for that stage.
 */
export function getModuleFromStatus(
  status
) {
  switch (status) {
    case 'pending_warehouse':
    case 'ready_for_dispatch':
      return 'warehouse'

    case 'ready_for_pdi':
      return 'pdi'

    case 'logistics_pending':
    case 'in_transit':
      return 'logistics'

    case 'closed':
      return 'completed'

    default:
      return null
  }
}
