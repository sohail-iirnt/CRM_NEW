import { STATUSES, TICKET_TYPES } from './config.js'

const inboundSource = (ticket, values) => values.includes(ticket.source)

export const DEFAULT_WORKFLOW_RULES = [
  {
    id: 'inbound-origin-5000',
    name: 'Inbound origin to 5000',
    enabled: true,
    conditions: { ticketType: TICKET_TYPES.INBOUND, sources: ['Haridwar', 'Shirwal', 'Khalapur'], destinationCompany: '5000' },
    steps: [STATUSES.PENDING_WAREHOUSE, STATUSES.READY_FOR_DISPATCH, STATUSES.LOGISTICS_PENDING, STATUSES.CLOSED],
  },
  {
    id: 'supplier-other',
    name: 'Supplier to non-5000 direct logistics',
    enabled: true,
    conditions: { ticketType: TICKET_TYPES.INBOUND, sources: ['Supplier'], destinationCompany: '__NOT_5000__' },
    steps: [STATUSES.LOGISTICS_PENDING, STATUSES.CLOSED],
  },
  {
    id: 'supplier-5000',
    name: 'Supplier to 5000 full flow',
    enabled: true,
    conditions: { ticketType: TICKET_TYPES.INBOUND, sources: ['Supplier'], destinationCompany: '5000' },
    steps: [STATUSES.PENDING_WAREHOUSE, STATUSES.READY_FOR_PDI, STATUSES.READY_FOR_DISPATCH, STATUSES.LOGISTICS_PENDING, STATUSES.CLOSED],
  },
]

export function matchesWorkflowRule(ticket, rule) {
  if (!rule.enabled || ticket.ticketType !== rule.conditions.ticketType) return false
  const { sources, destinationCompany } = rule.conditions
  const sourceMatches = !sources?.length || inboundSource(ticket, sources)
  if (!sourceMatches) return false
  if (destinationCompany === '__NOT_5000__') return ticket.destinationCompany !== '5000'
  return !destinationCompany || ticket.destinationCompany === destinationCompany
}

export function resolveWorkflow(ticket, rules = DEFAULT_WORKFLOW_RULES) {
  const rule = rules.find((candidate) => matchesWorkflowRule(ticket, candidate))
  if (rule) return { ruleId: rule.id, ruleName: rule.name, steps: rule.steps }

  // Outbound and unmatched tickets remain safely configurable from Admin.
  return { ruleId: null, ruleName: 'Unconfigured workflow', steps: [] }
}

export function getNextStatus(ticket, rules) {
  const workflow = resolveWorkflow(ticket, rules)
  if (!workflow.steps.length) return null
  const index = workflow.steps.indexOf(ticket.currentStatus)
  return index >= 0 ? workflow.steps[index + 1] ?? null : workflow.steps[0]
}
