import { STATUSES, TICKET_TYPES } from './config.js'

const inboundSource = (ticket, values = []) =>
  values.includes(ticket.source)

/*
 * Default workflow configuration.
 *
 * These are the initial rules used by the system.
 * Later, Admin → Flow Manager will be able to manage
 * these rules from Firestore without changing application code.
 */
export const DEFAULT_WORKFLOW_RULES = [
  {
    id: 'inbound-origin-5000',
    name: 'Inbound Origin → 5000',
    enabled: true,

    conditions: {
      ticketType: TICKET_TYPES.INBOUND,
      sources: [
        'Haridwar',
        'Shirwal',
        'Khalapur'
      ],
      destinationCompany: '5000'
    },

    steps: [
      STATUSES.PENDING_WAREHOUSE,
      STATUSES.READY_FOR_DISPATCH,
      STATUSES.LOGISTICS_PENDING,
      STATUSES.IN_TRANSIT,
      STATUSES.CLOSED
    ]
  },

  {
    id: 'supplier-other',
    name: 'Supplier → Non-5000 → Direct Logistics',
    enabled: true,

    conditions: {
      ticketType: TICKET_TYPES.INBOUND,
      sources: [
        'Supplier'
      ],
      destinationCompany: '**NOT_5000**'
    },

    steps: [
      STATUSES.LOGISTICS_PENDING,
      STATUSES.IN_TRANSIT,
      STATUSES.CLOSED
    ]
  },

  {
    id: 'supplier-5000',
    name: 'Supplier → 5000 → Full Flow',
    enabled: true,

    conditions: {
      ticketType: TICKET_TYPES.INBOUND,
      sources: [
        'Supplier'
      ],
      destinationCompany: '5000'
    },

    steps: [
      STATUSES.PENDING_WAREHOUSE,
      STATUSES.READY_FOR_PDI,
      STATUSES.READY_FOR_DISPATCH,
      STATUSES.LOGISTICS_PENDING,
      STATUSES.IN_TRANSIT,
      STATUSES.CLOSED
    ]
  }
]

/*
 * Safely compare a ticket against a workflow rule.
 */
export function matchesWorkflowRule(ticket, rule) {
  if (!ticket || !rule) return false

  if (rule.enabled === false) {
    return false
  }

  const conditions = rule.conditions || {}

  /*
   * Ticket type condition.
   */
  if (
    conditions.ticketType &&
    ticket.ticketType !== conditions.ticketType
  ) {
    return false
  }

  /*
   * Source condition.
   */
  if (
    Array.isArray(conditions.sources) &&
    conditions.sources.length > 0
  ) {
    if (!inboundSource(ticket, conditions.sources)) {
      return false
    }
  }

  /*
   * Destination company condition.
   *
   * Special value:
   * **NOT_5000**
   *
   * means any destination company other than 5000.
   */
  if (conditions.destinationCompany) {
    if (
      conditions.destinationCompany === '**NOT_5000**'
    ) {
      if (ticket.destinationCompany === '5000') {
        return false
      }
    } else if (
      ticket.destinationCompany !==
      conditions.destinationCompany
    ) {
      return false
    }
  }

  /*
   * Optional destination branch condition.
   */
  if (
    Array.isArray(conditions.destinationBranches) &&
    conditions.destinationBranches.length > 0
  ) {
    if (
      !conditions.destinationBranches.includes(
        ticket.destinationBranch
      )
    ) {
      return false
    }
  }

  /*
   * Optional position condition.
   */
  if (
    Array.isArray(conditions.positions) &&
    conditions.positions.length > 0
  ) {
    if (
      !conditions.positions.includes(ticket.position)
    ) {
      return false
    }
  }

  return true
}

/*
 * Resolve the first enabled rule matching the ticket.
 */
export function resolveWorkflow(
  ticket,
  rules = DEFAULT_WORKFLOW_RULES
) {
  const availableRules = Array.isArray(rules)
    ? rules
    : DEFAULT_WORKFLOW_RULES

  const rule = availableRules.find(
    candidate =>
      matchesWorkflowRule(ticket, candidate)
  )

  if (rule) {
    return {
      id: rule.id,
      ruleId: rule.id,
      ruleName: rule.name,
      steps: Array.isArray(rule.steps)
        ? rule.steps
        : []
    }
  }

  /*
   * No matching workflow.
   *
   * This is intentional.
   * We must never silently send an unconfigured
   * ticket into the wrong operational department.
   */
  return {
    id: null,
    ruleId: null,
    ruleName: 'Unconfigured workflow',
    steps: []
  }
}

/*
 * Get the first operational status of a workflow.
 */
export function getInitialStatus(
  ticket,
  rules = DEFAULT_WORKFLOW_RULES
) {
  const workflow = resolveWorkflow(
    ticket,
    rules
  )

  return workflow.steps[0] || null
}

/*
 * Get the next status after the ticket's current status.
 */
export function getNextStatus(
  ticket,
  rules = DEFAULT_WORKFLOW_RULES
) {
  const workflow = resolveWorkflow(
    ticket,
    rules
  )

  if (!workflow.steps.length) {
    return null
  }

  const index = workflow.steps.indexOf(
    ticket.currentStatus
  )

  /*
   * A ticket with no current status starts
   * at the first workflow step.
   */
  if (index === -1) {
    return workflow.steps[0]
  }

  return workflow.steps[index + 1] || null
}

/*
 * Determine whether the ticket has reached
 * the final workflow step.
 */
export function isWorkflowComplete(
  ticket,
  rules = DEFAULT_WORKFLOW_RULES
) {
  const workflow = resolveWorkflow(
    ticket,
    rules
  )

  if (!workflow.steps.length) {
    return false
  }

  return (
    ticket.currentStatus ===
    workflow.steps[workflow.steps.length - 1]
  )
}

/*
 * Determine whether a ticket is currently
 * waiting for a particular module.
 */
export function isAtStatus(
  ticket,
  status
) {
  return ticket?.currentStatus === status
}

/*
 * Get a human-readable workflow sequence.
 */
export function getWorkflowSequence(
  ticket,
  rules = DEFAULT_WORKFLOW_RULES
) {
  const workflow = resolveWorkflow(
    ticket,
    rules
  )

  return workflow.steps
}

/*
 * Validate a workflow before it is saved by
 * the future Admin → Flow Manager.
 */
export function validateWorkflowRule(rule) {
  const errors = []

  if (!rule?.id) {
    errors.push('Workflow ID is required.')
  }

  if (!rule?.name) {
    errors.push('Workflow name is required.')
  }

  if (
    !rule?.conditions ||
    typeof rule.conditions !== 'object'
  ) {
    errors.push('Workflow conditions are required.')
  }

  if (
    !Array.isArray(rule?.steps) ||
    rule.steps.length === 0
  ) {
    errors.push(
      'Workflow must contain at least one step.'
    )
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/*
 * Return a safe copy of the default rules.
 *
 * This prevents components from accidentally
 * mutating DEFAULT_WORKFLOW_RULES directly.
 */
export function getDefaultWorkflowRules() {
  return DEFAULT_WORKFLOW_RULES.map(rule => ({
    ...rule,
    conditions: {
      ...rule.conditions,
      sources: Array.isArray(
        rule.conditions?.sources
      )
        ? [...rule.conditions.sources]
        : undefined
    },
    steps: [...rule.steps]
  }))
}