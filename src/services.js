import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
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

  const ref = await addDoc(
    collection(db, TICKETS),
    payload
  )

  await writeLog({
    action: 'ticket_created',
    ticketId: ref.id,
    details:
      `${ticket.ticketType} ticket ${ticket.ticketId} created using workflow "${workflow.ruleName}". Initial status: ${initialStatus}.`,
    actor
  })

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
  action = 'ticket_updated'
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

  await updateDoc(
    doc(
      db,
      TICKETS,
      id
    ),
    {
      ...changes,

      updatedAt:
        serverTimestamp(),

      lastActionAt:
        serverTimestamp(),

      lastActionBy:
        actor?.uid || '',

      lastActionByName:
        actor?.name ||
        actor?.email ||
        '',

      lastActionByRole:
        actor?.role ||
        ''
    }
  )

  await writeLog({
    action,
    ticketId: id,
    details:
      JSON.stringify(
        changes
      ),
    actor
  })
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
  actor
}) {
  if (!db) {
    return
  }

  await addDoc(
    collection(
      db,
      LOGS
    ),
    {
      action,

      ticketId,

      details,

      userId:
        actor?.uid ||
        '',

      userName:
        actor?.name ||
        actor?.email ||
        '',

      role:
        actor?.role ||
        '',

      createdAt:
        serverTimestamp()
    }
  )
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