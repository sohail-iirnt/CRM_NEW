import { useEffect, useMemo, useState } from 'react'
import { STATUS_LABELS, STATUSES } from '../config.js'
import { subscribeLogs, subscribeTickets } from '../services.js'

const modules = ['crm', 'warehouse', 'pdi', 'logistics']
const timeValue = value => value?.toMillis ? value.toMillis() : 0
const formatDate = value => value ? new Date(value).toLocaleString() : '—'
const formatDuration = milliseconds => {
  if (!milliseconds || milliseconds < 0) return '—'
  const minutes = Math.round(milliseconds / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours < 24) return `${hours}h ${remaining}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

export default function Analytics() {
  const [tickets, setTickets] = useState([])
  const [logs, setLogs] = useState([])
  const [tab, setTab] = useState('overview')
  useEffect(() => subscribeTickets(setTickets), [])
  useEffect(() => subscribeLogs(setLogs), [])

  const analytics = useMemo(() => {
    const validLogs = logs.filter(log => timeValue(log.createdAt) > 0)
    const closed = tickets.filter(ticket => ticket.currentStatus === STATUSES.CLOSED)
    const active = tickets.filter(ticket => ticket.currentStatus !== STATUSES.CLOSED)
    const inTransit = tickets.filter(ticket => ticket.currentStatus === STATUSES.IN_TRANSIT)
    const closureDurations = closed.map(ticket => {
      const start = timeValue(ticket.createdAt)
      const end = timeValue(ticket.updatedAt) || timeValue(ticket.lastActionAt)
      return start && end ? end - start : 0
    }).filter(Boolean)
    const avgClosure = closureDurations.length ? closureDurations.reduce((sum, value) => sum + value, 0) / closureDurations.length : 0
    const statusRows = Object.entries(STATUS_LABELS).map(([status, label]) => ({ label, count: tickets.filter(ticket => ticket.currentStatus === status).length }))
    const departmentRows = modules.map(module => {
      const departmentLogs = validLogs.filter(log => log.module === module || log.role === module)
      const touchedTickets = new Set(departmentLogs.map(log => log.ticketId).filter(Boolean))
      const latest = departmentLogs.reduce((latestLog, log) => timeValue(log.createdAt) > timeValue(latestLog?.createdAt) ? log : latestLog, null)
      return { module, actions: departmentLogs.length, tickets: touchedTickets.size, latest }
    })
    const typeRows = ['inbound', 'outbound'].map(type => ({ label: type, count: tickets.filter(ticket => ticket.ticketType === type).length }))
    const sourceRows = [...new Set(tickets.map(ticket => ticket.source).filter(Boolean))].map(source => ({ label: source, count: tickets.filter(ticket => ticket.source === source).length })).sort((a, b) => b.count - a.count)
    const transitions = validLogs.filter(log => log.previousStatus || log.newStatus).reduce((map, log) => {
      const key = `${STATUS_LABELS[log.previousStatus] || log.previousStatus || 'Start'} → ${STATUS_LABELS[log.newStatus] || log.newStatus || '—'}`
      map[key] = (map[key] || 0) + 1
      return map
    }, {})
    const recent = [...validLogs].sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt)).slice(0, 12)
    return { total: tickets.length, active: active.length, closed: closed.length, inTransit: inTransit.length, avgClosure, statusRows, departmentRows, typeRows, sourceRows, transitions: Object.entries(transitions).sort((a, b) => b[1] - a[1]), recent }
  }, [tickets, logs])

  const ticketLabel = id => tickets.find(ticket => ticket.id === id)?.ticketId || id || '—'

  return <section className="page">
    <div className="page-head"><div><div className="eyebrow">OPERATIONS INTELLIGENCE</div><h1>Analytics Dashboard</h1><p className="muted">Live performance, workflow, department activity and ticket analytics from the CRM SAIDHARA audit trail.</p></div><div className="live-pill"><span className="status-dot" />Live</div></div>
    <div className="tabs"><button className={tab === 'overview' ? 'tab active' : 'tab'} onClick={() => setTab('overview')}>Operations Overview</button><button className={tab === 'tickets' ? 'tab active' : 'tab'} onClick={() => setTab('tickets')}>Ticket Analytics</button><button className={tab === 'departments' ? 'tab active' : 'tab'} onClick={() => setTab('departments')}>Department Performance</button><button className={tab === 'workflow' ? 'tab active' : 'tab'} onClick={() => setTab('workflow')}>Status & Workflow</button></div>
    <div className="kpi-grid analytics-kpis"><div className="kpi"><small>Total Tickets</small><strong>{analytics.total}</strong></div><div className="kpi"><small>Active Tickets</small><strong>{analytics.active}</strong></div><div className="kpi"><small>Closed Tickets</small><strong>{analytics.closed}</strong></div><div className="kpi"><small>In Transit</small><strong>{analytics.inTransit}</strong></div><div className="kpi"><small>Avg. Closure Time</small><strong>{formatDuration(analytics.avgClosure)}</strong></div></div>

    {tab === 'overview' && <div className="analytics-columns"><div className="card"><div className="card-head"><div><h2>Status Distribution</h2><p className="muted">Current live position of every ticket.</p></div></div><div className="metric-list">{analytics.statusRows.map(row => <div className="metric-row" key={row.label}><span>{row.label}</span><strong>{row.count}</strong></div>)}</div></div><div className="card"><div className="card-head"><div><h2>Department Activity</h2><p className="muted">Recorded actions in the audit trail.</p></div></div><div className="metric-list">{analytics.departmentRows.map(row => <div className="metric-row" key={row.module}><span>{row.module.toUpperCase()} <small>{row.tickets} tickets touched</small></span><strong>{row.actions}</strong></div>)}</div></div></div>}

    {tab === 'tickets' && <div className="analytics-columns"><div className="card"><h2>Ticket Type</h2><div className="metric-list">{analytics.typeRows.map(row => <div className="metric-row" key={row.label}><span>{row.label.toUpperCase()}</span><strong>{row.count}</strong></div>)}</div></div><div className="card"><h2>Inbound Sources</h2><div className="metric-list">{analytics.sourceRows.length ? analytics.sourceRows.map(row => <div className="metric-row" key={row.label}><span>{row.label}</span><strong>{row.count}</strong></div>) : <p className="muted">No source data available yet.</p>}</div></div></div>}

    {tab === 'departments' && <div className="card"><h2>Department Performance</h2><div className="table-wrap"><table><thead><tr><th>Department</th><th>Actions</th><th>Tickets Touched</th><th>Latest Action</th><th>Latest Activity</th></tr></thead><tbody>{analytics.departmentRows.map(row => <tr key={row.module}><td className="strong">{row.module.toUpperCase()}</td><td>{row.actions}</td><td>{row.tickets}</td><td>{row.latest?.action || '—'}</td><td>{formatDate(timeValue(row.latest?.createdAt))}</td></tr>)}</tbody></table></div></div>}

    {tab === 'workflow' && <div className="analytics-columns"><div className="card"><h2>Workflow Transitions</h2><div className="metric-list">{analytics.transitions.length ? analytics.transitions.map(([transition, count]) => <div className="metric-row" key={transition}><span>{transition}</span><strong>{count}</strong></div>) : <p className="muted">No timestamped transitions recorded yet.</p>}</div></div><div className="card"><h2>Recent Audit Activity</h2><div className="recent-list">{analytics.recent.map(log => <div className="recent-item" key={log.id}><div><strong>{log.action}</strong><span>{log.userName || 'System'} · {ticketLabel(log.ticketId)}</span></div><time>{formatDate(timeValue(log.createdAt))}</time></div>)}</div></div></div>}

    <div className="card analytics-note"><strong>Audit-backed analytics</strong><p className="muted">All counts and activity views are derived from live tickets and immutable systemLogs records. Server timestamps are used wherever available.</p></div>
  </section>
}
