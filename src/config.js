export const ROLES = Object.freeze({
  ADMIN: 'admin',
  CRM: 'crm',
  WAREHOUSE: 'warehouse',
  PDI: 'pdi',
  LOGISTICS: 'logistics',
})

export const MODULES = Object.freeze({
  CRM: 'crm',
  WAREHOUSE: 'warehouse',
  PDI: 'pdi',
  LOGISTICS: 'logistics',
  ADMIN: 'admin',
})

export const SHEDS = ['S', 'P', 'T', 'O', 'SS (Padgha)']

export const TICKET_TYPES = Object.freeze({
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
})

export const INBOUND_SOURCES = ['Haridwar', 'Shirwal', 'Shirval', 'Khalapur', 'Supplier', 'Other']
export const DESTINATION_COMPANIES = ['5000', 'Other']
export const PDI_RESULTS = ['PDI OK', 'ALL MATERIAL DAMAGE', 'NO STOCK', 'Other']
export const DISPATCH_METHODS = ['Dedicated', 'Courier']

export const STATUSES = Object.freeze({
  PENDING_WAREHOUSE: 'pending_warehouse',
  READY_FOR_PDI: 'ready_for_pdi',
  FORWARD_ORDER_PENDING: 'forward_order_pending',
  READY_FOR_DISPATCH: 'ready_for_dispatch',
  LOGISTICS_PENDING: 'logistics_pending',
  IN_TRANSIT: 'in_transit',
  CLOSED: 'closed',
})

export const STATUS_LABELS = Object.freeze({
  [STATUSES.PENDING_WAREHOUSE]: 'Pending Warehouse',
  [STATUSES.READY_FOR_PDI]: 'Ready for PDI',
  [STATUSES.FORWARD_ORDER_PENDING]: 'Forward Order Pending',
  [STATUSES.READY_FOR_DISPATCH]: 'Ready for Dispatch',
  [STATUSES.LOGISTICS_PENDING]: 'Logistics Pending',
  [STATUSES.IN_TRANSIT]: 'In Transit',
  [STATUSES.CLOSED]: 'Closed',
})
