import { STATUSES, TICKET_TYPES } from './config.js'

const normalize=value=>String(value||'').trim().toLowerCase()
const inboundSource=(ticket,values=[])=>values.map(normalize).includes(normalize(ticket?.source))

export const FORWARD_ORDER_SOURCES=['Haridwar','Shirwal','Shirval','Khalapur','Supplier']
export const isForwardOrderTicket=ticket=>ticket?.ticketType===TICKET_TYPES.INBOUND&&normalize(ticket?.destinationCompany)==='5000'&&inboundSource(ticket,FORWARD_ORDER_SOURCES)

export const DEFAULT_WORKFLOW_RULES=[
 {id:'outbound-full-flow',name:'Outbound → Full Operational Flow',enabled:true,conditions:{ticketType:TICKET_TYPES.OUTBOUND},steps:[STATUSES.PENDING_WAREHOUSE,STATUSES.READY_FOR_PDI,STATUSES.READY_FOR_DISPATCH,STATUSES.LOGISTICS_PENDING,STATUSES.IN_TRANSIT,STATUSES.CLOSED]},
 {id:'inbound-forward-order',name:'Inbound → Warehouse → CRM Forward Order → Dispatch → Logistics',enabled:true,conditions:{ticketType:TICKET_TYPES.INBOUND,sources:FORWARD_ORDER_SOURCES,destinationCompany:'5000'},steps:[STATUSES.PENDING_WAREHOUSE,STATUSES.FORWARD_ORDER_PENDING,STATUSES.READY_FOR_DISPATCH,STATUSES.LOGISTICS_PENDING,STATUSES.IN_TRANSIT,STATUSES.CLOSED]},
 {id:'inbound-origin-5000',name:'Inbound Origin → 5000',enabled:true,conditions:{ticketType:TICKET_TYPES.INBOUND,sources:['Haridwar','Shirwal','Shirval','Khalapur'],destinationCompany:'5000'},steps:[STATUSES.PENDING_WAREHOUSE,STATUSES.READY_FOR_DISPATCH,STATUSES.LOGISTICS_PENDING,STATUSES.IN_TRANSIT,STATUSES.CLOSED]},
 {id:'supplier-other',name:'Supplier → Non-5000 → Direct Logistics',enabled:true,conditions:{ticketType:TICKET_TYPES.INBOUND,sources:['Supplier'],destinationCompany:'**NOT_5000**'},steps:[STATUSES.LOGISTICS_PENDING,STATUSES.IN_TRANSIT,STATUSES.CLOSED]},
 {id:'supplier-5000',name:'Supplier → 5000 → Full Flow',enabled:true,conditions:{ticketType:TICKET_TYPES.INBOUND,sources:['Supplier'],destinationCompany:'5000'},steps:[STATUSES.PENDING_WAREHOUSE,STATUSES.READY_FOR_PDI,STATUSES.READY_FOR_DISPATCH,STATUSES.LOGISTICS_PENDING,STATUSES.IN_TRANSIT,STATUSES.CLOSED]}
]
export function matchesWorkflowRule(ticket,rule){if(!ticket||!rule||rule.enabled===false)return false;const c=rule.conditions||{};if(c.ticketType&&ticket.ticketType!==c.ticketType)return false;if(Array.isArray(c.sources)&&c.sources.length&&!inboundSource(ticket,c.sources))return false;if(c.destinationCompany){if(c.destinationCompany==='**NOT_5000**'){if(normalize(ticket.destinationCompany)==='5000')return false}else if(normalize(ticket.destinationCompany)!==normalize(c.destinationCompany))return false}if(Array.isArray(c.destinationBranches)&&c.destinationBranches.length&&!c.destinationBranches.includes(ticket.destinationBranch))return false;if(Array.isArray(c.positions)&&c.positions.length&&!c.positions.includes(ticket.position))return false;return true}
export function resolveWorkflow(ticket,rules=DEFAULT_WORKFLOW_RULES){const rule=(Array.isArray(rules)?rules:DEFAULT_WORKFLOW_RULES).find(candidate=>matchesWorkflowRule(ticket,candidate));return rule?{id:rule.id,ruleId:rule.id,ruleName:rule.name,steps:Array.isArray(rule.steps)?rule.steps:[]}:{id:null,ruleId:null,ruleName:'Unconfigured workflow',steps:[]}}
export function getInitialStatus(ticket,rules=DEFAULT_WORKFLOW_RULES){return resolveWorkflow(ticket,rules).steps[0]||null}
export function getNextStatus(ticket,rules=DEFAULT_WORKFLOW_RULES){const steps=resolveWorkflow(ticket,rules).steps;if(!steps.length)return null;const index=steps.indexOf(ticket.currentStatus);return index===-1?steps[0]:steps[index+1]||null}
export function isWorkflowComplete(ticket,rules=DEFAULT_WORKFLOW_RULES){const steps=resolveWorkflow(ticket,rules).steps;return steps.length>0&&ticket.currentStatus===steps[steps.length-1]}
export function isAtStatus(ticket,status){return ticket?.currentStatus===status}
export function getWorkflowSequence(ticket,rules=DEFAULT_WORKFLOW_RULES){return resolveWorkflow(ticket,rules).steps}
export function validateWorkflowRule(rule){const errors=[];if(!rule?.id)errors.push('Workflow ID is required.');if(!rule?.name)errors.push('Workflow name is required.');if(!rule?.conditions||typeof rule.conditions!=='object')errors.push('Workflow conditions are required.');if(!Array.isArray(rule?.steps)||!rule.steps.length)errors.push('Workflow must contain at least one step.');return{valid:!errors.length,errors}}
export function getDefaultWorkflowRules(){return DEFAULT_WORKFLOW_RULES.map(rule=>({...rule,conditions:{...rule.conditions,sources:Array.isArray(rule.conditions?.sources)?[...rule.conditions.sources]:undefined},steps:[...rule.steps]}))}
