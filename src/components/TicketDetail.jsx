import { useEffect, useState } from 'react'
import { STATUS_LABELS } from '../config.js'
import { subscribeTicketActivity } from '../services.js'

const excluded = new Set(['id', 'workflowSteps', 'createdBy', 'createdByName', 'createdByRole', 'createdAt', 'updatedAt', 'lastActionAt', 'lastActionBy', 'lastActionByName', 'lastActionByRole', 'previousStatus', 'statusChangedAt', 'dispatch', 'pdi', 'logistics'])

export function TicketLink({ ticket, onOpen }) {
  return <button type="button" className="ticket-link" onClick={() => onOpen(ticket)}>{ticket.ticketId || ticket.id}</button>
}

const formatTime = value => value?.toDate ? value.toDate().toLocaleString() : 'Awaiting server timestamp'
const titleize = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())
const value = item => item === undefined || item === null || item === '' ? '—' : typeof item === 'object' ? Object.entries(item).map(([key, entry]) => `${titleize(key)}: ${entry || '—'}`).join(' · ') : String(item)

export default function TicketDetail({ ticket, onClose }) {
  const [activity, setActivity] = useState([])

  useEffect(() => subscribeTicketActivity(ticket?.id, setActivity, console.error), [ticket?.id])
  if (!ticket) return null

  const fields = Object.entries(ticket).filter(([key]) => !excluded.has(key))
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="ticket-modal" role="dialog" aria-modal="true" aria-label={`Ticket ${ticket.ticketId || ticket.id}`} onMouseDown={event => event.stopPropagation()}>
      <div className="card-head">
        <div><div className="eyebrow">TICKET DETAIL</div><h2>{ticket.ticketId || ticket.id}</h2><p className="muted">Created {formatTime(ticket.createdAt)} by {ticket.createdByName || '—'} ({ticket.createdByRole || '—'})</p></div>
        <button className="secondary" onClick={onClose}>Close</button>
      </div>

      <div className="detail-summary">
        <div><small>Current status</small><strong>{STATUS_LABELS[ticket.currentStatus] || ticket.currentStatus || '—'}</strong></div>
        <div><small>Current module</small><strong>{ticket.currentModule || '—'}</strong></div>
        <div><small>Last updated</small><strong>{formatTime(ticket.updatedAt)}</strong></div>
        <div><small>Last actor</small><strong>{ticket.lastActionByName || ticket.createdByName || '—'}</strong></div>
      </div>

      <h3>Workflow sequence</h3>
      <div className="workflow-steps">{(ticket.workflowSteps || []).map((step, index) => <span className={step === ticket.currentStatus ? 'workflow-step current' : 'workflow-step'} key={step}>{index + 1}. {STATUS_LABELS[step] || step}</span>)}</div>

      <h3>Ticket information</h3>
      <div className="detail-grid">{fields.map(([key, entry]) => <div key={key}><small>{titleize(key)}</small><strong>{value(entry)}</strong></div>)}</div>

      {(ticket.dispatch || ticket.pdi || ticket.logistics) && <><h3>Operational information</h3><div className="detail-grid">{ticket.dispatch && <div><small>Dispatch</small><strong>{value(ticket.dispatch)}</strong></div>}{ticket.pdi && <div><small>PDI</small><strong>{value(ticket.pdi)}</strong></div>}{ticket.logistics && <div><small>Logistics</small><strong>{value(ticket.logistics)}</strong></div>}</div></>}

      <h3>Activity timeline</h3>
      <ol className="timeline">{activity.length ? activity.map(log => <li key={log.id}><time>{formatTime(log.createdAt)}</time><strong>{log.userName || 'System'} — {(log.role || log.module || 'system').toUpperCase()} — {titleize(log.action)}</strong><span>{log.details || '—'}</span>{(log.previousStatus || log.newStatus) && <em>{STATUS_LABELS[log.previousStatus] || log.previousStatus || 'Start'} → {STATUS_LABELS[log.newStatus] || log.newStatus || 'No status change'}</em>}</li>) : <li><span>No activity records found yet.</span></li>}</ol>
    </section>
  </div>
}
