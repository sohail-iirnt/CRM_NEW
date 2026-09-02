import { useEffect, useMemo, useState } from 'react'
import { STATUS_LABELS, STATUSES, SHEDS } from '../config.js'
import { subscribeLogs, subscribeTickets } from '../services.js'

const modules = ['crm', 'warehouse', 'pdi', 'logistics']
const tv = v => v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0
const daysAgo = n => Date.now() - n * 86400000
const monthKey = v => {
  const ms = tv(v)
  if (!ms || Number.isNaN(ms)) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = value => {
  if (!value) return 'All Months'
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
const duration = ms => {
  if (!ms || ms < 0) return '—'
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

function BarChart({ rows = [] }) {
  const max = Math.max(1, ...rows.map(x => Number(x.count) || 0))
  return (
    <div className="bar-chart">
      {rows.map(x => (
        <div className="bar-row" key={x.label}>
          <div className="bar-label"><span>{x.label}</span><strong>{x.count}</strong></div>
          <div className="bar-track"><i style={{ width: `${((Number(x.count) || 0) / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [tickets, setTickets] = useState([])
  const [logs, setLogs] = useState([])
  const [tab, setTab] = useState('overview')
  const [shed, setShed] = useState('ALL')
  const [month, setMonth] = useState('')

  useEffect(() => subscribeTickets(setTickets), [])
  useEffect(() => subscribeLogs(setLogs), [])

  const monthOptions = useMemo(() => (
    [...new Set(tickets.map(ticket => monthKey(ticket.createdAt)).filter(Boolean))].sort().reverse()
  ), [tickets])

  const a = useMemo(() => {
    const monthScoped = month ? tickets.filter(ticket => monthKey(ticket.createdAt) === month) : tickets
    const scoped = shed === 'ALL' ? monthScoped : monthScoped.filter(ticket => ticket.shed === shed)
    const scopedIds = new Set(scoped.map(ticket => ticket.id).filter(Boolean))
    const closed = scoped.filter(ticket => ticket.currentStatus === STATUSES.CLOSED)
    const active = scoped.filter(ticket => ticket.currentStatus !== STATUSES.CLOSED)
    const ages = active.map(ticket => Date.now() - tv(ticket.createdAt)).filter(value => value > 0)
    const closures = closed.map(ticket => tv(ticket.updatedAt) - tv(ticket.createdAt)).filter(value => value > 0)
    const relevantLogs = logs.filter(log => scopedIds.has(log.ticketId))
    const pdi = relevantLogs.filter(log => log.module === 'pdi' || log.role === 'pdi')
    const inspections = pdi.filter(log => log.action === 'pdi_inspection_completed')
    const checked = inspections.reduce((sum, log) => sum + Number(log.metadata?.checked || 0), 0)
    const damaged = inspections.reduce((sum, log) => sum + Number(log.metadata?.damaged || 0), 0)
    const noStockClosures = scoped.filter(ticket => ticket.pdi?.closedReason === 'no_stock').length
    const statusRows = Object.entries(STATUS_LABELS)
      .map(([status, label]) => ({ label, count: scoped.filter(ticket => ticket.currentStatus === status).length }))
      .filter(row => row.count || scoped.length)
    const shedRows = SHEDS.map(value => ({ label: value, count: monthScoped.filter(ticket => ticket.shed === value).length }))
    const typeRows = ['inbound', 'outbound'].map(type => ({ label: type.toUpperCase(), count: scoped.filter(ticket => ticket.ticketType === type).length }))
    const dept = modules.map(module => {
      const moduleLogs = relevantLogs.filter(log => log.module === module || log.role === module)
      return {
        module,
        actions: moduleLogs.length,
        tickets: new Set(moduleLogs.map(log => log.ticketId).filter(Boolean)).size,
        recent: moduleLogs.filter(log => tv(log.createdAt) >= daysAgo(7)).length
      }
    })
    const transitions = relevantLogs
      .filter(log => log.previousStatus || log.newStatus)
      .reduce((map, log) => {
        const key = `${STATUS_LABELS[log.previousStatus] || log.previousStatus || 'Start'} → ${STATUS_LABELS[log.newStatus] || log.newStatus || '—'}`
        map[key] = (map[key] || 0) + 1
        return map
      }, {})

    return {
      total: scoped.length,
      closed: closed.length,
      active: active.length,
      inTransit: scoped.filter(ticket => ticket.currentStatus === STATUSES.IN_TRANSIT).length,
      last7: scoped.filter(ticket => tv(ticket.createdAt) >= daysAgo(7)).length,
      last30: scoped.filter(ticket => tv(ticket.createdAt) >= daysAgo(30)).length,
      avgAge: ages.length ? ages.reduce((sum, value) => sum + value, 0) / ages.length : 0,
      avgClosure: closures.length ? closures.reduce((sum, value) => sum + value, 0) / closures.length : 0,
      checked,
      damaged,
      approved: Math.max(0, checked - damaged),
      damageRate: checked ? damaged / checked * 100 : 0,
      noStockClosures,
      auditRecords: relevantLogs.length,
      statusRows,
      shedRows,
      typeRows,
      dept,
      transitions: Object.entries(transitions).sort((a, b) => b[1] - a[1])
    }
  }, [tickets, logs, shed, month])

  const selectedLabel = month ? monthLabel(month) : 'All Months'

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">OPERATIONS INTELLIGENCE</div>
          <h1>Analytics Dashboard</h1>
          <p className="muted">Live business intelligence across tickets, sheds, departments, workflow and PDI quality.</p>
        </div>
        <div className="analytics-filter">
          <span>MONTH</span>
          <select value={month} onChange={event => setMonth(event.target.value)}>
            <option value="">All Months</option>
            {monthOptions.map(value => <option key={value} value={value}>{monthLabel(value)}</option>)}
          </select>
          <span>SHED</span>
          <select value={shed} onChange={event => setShed(event.target.value)}>
            <option value="ALL">All Sheds</option>
            {SHEDS.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>

      <div className="card analytics-period-summary">
        <div className="card-head">
          <div>
            <h2>{selectedLabel} Analytics</h2>
            <p className="muted">All analytics below use the selected month and shed scope.</p>
          </div>
          <div className="summary-count">{a.total} Tickets</div>
        </div>
      </div>

      <div className="tabs analytics-tabs">
        {['overview', 'sheds', 'throughput', 'quality', 'departments', 'workflow'].map(key => (
          <button key={key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>
            {key === 'overview' ? 'Executive Overview' : key === 'sheds' ? 'Shed Intelligence' : key === 'throughput' ? 'Throughput & Aging' : key === 'quality' ? 'PDI Quality' : key === 'departments' ? 'Departments' : 'Workflow & Audit'}
          </button>
        ))}
      </div>

      <div className="kpi-grid analytics-kpis">
        <div className="kpi"><small>Total Tickets</small><strong>{a.total}</strong></div>
        <div className="kpi"><small>Active</small><strong>{a.active}</strong></div>
        <div className="kpi"><small>Closed</small><strong>{a.closed}</strong></div>
        <div className="kpi"><small>In Transit</small><strong>{a.inTransit}</strong></div>
        <div className="kpi"><small>7-Day Intake</small><strong>{a.last7}</strong></div>
        <div className="kpi"><small>Avg Closure</small><strong>{duration(a.avgClosure)}</strong></div>
      </div>

      {tab === 'overview' && <div className="analytics-columns">
        <div className="card chart-card"><h2>Ticket Status Distribution</h2><BarChart rows={a.statusRows} /></div>
        <div className="card chart-card"><h2>Inbound / Outbound</h2><BarChart rows={a.typeRows} /></div>
      </div>}

      {tab === 'sheds' && <div className="analytics-columns">
        <div className="card chart-card"><h2>Tickets by Shed</h2><BarChart rows={a.shedRows} /></div>
        <div className="card"><h2>Shed Summary</h2><div className="metric-list">{a.shedRows.map(row => <div className="metric-row" key={row.label}><span>Shed {row.label}</span><strong>{row.count} tickets</strong></div>)}</div></div>
      </div>}

      {tab === 'throughput' && <div className="analytics-columns">
        <div className="card chart-card"><h2>Throughput</h2><BarChart rows={[{ label: 'Last 7 Days', count: a.last7 }, { label: 'Last 30 Days', count: a.last30 }, { label: 'Active', count: a.active }, { label: 'Closed', count: a.closed }]} /></div>
        <div className="card"><h2>Operational Ratios</h2><div className="metric-list">
          <div className="metric-row"><span>Active share</span><strong>{a.total ? Math.round(a.active / a.total * 100) : 0}%</strong></div>
          <div className="metric-row"><span>Closure rate</span><strong>{a.total ? Math.round(a.closed / a.total * 100) : 0}%</strong></div>
          <div className="metric-row"><span>Average active age</span><strong>{duration(a.avgAge)}</strong></div>
          <div className="metric-row"><span>Average closure</span><strong>{duration(a.avgClosure)}</strong></div>
        </div></div>
      </div>}

      {tab === 'quality' && <div className="analytics-columns">
        <div className="card chart-card"><h2>PDI Quality</h2><BarChart rows={[{ label: 'Units Checked', count: a.checked }, { label: 'Damaged / Defective', count: a.damaged }, { label: 'Approved', count: a.approved }, { label: 'No-Stock Closures', count: a.noStockClosures }]} /></div>
        <div className="card"><h2>Quality KPIs</h2><div className="metric-list">
          <div className="metric-row"><span>Total units checked</span><strong>{a.checked}</strong></div>
          <div className="metric-row"><span>Damaged units</span><strong>{a.damaged}</strong></div>
          <div className="metric-row"><span>Approved units</span><strong>{a.approved}</strong></div>
          <div className="metric-row"><span>Damage rate</span><strong>{a.damageRate.toFixed(1)}%</strong></div>
          <div className="metric-row"><span>No-stock closures</span><strong>{a.noStockClosures}</strong></div>
        </div></div>
      </div>}

      {tab === 'departments' && <div className="card"><h2>Department Performance</h2><div className="table-wrap"><table><thead><tr><th>Department</th><th>Total Actions</th><th>Tickets Touched</th><th>7-Day Actions</th></tr></thead><tbody>{a.dept.map(row => <tr key={row.module}><td className="strong">{row.module.toUpperCase()}</td><td>{row.actions}</td><td>{row.tickets}</td><td>{row.recent}</td></tr>)}</tbody></table></div></div>}

      {tab === 'workflow' && <div className="analytics-columns">
        <div className="card chart-card"><h2>Workflow Transitions</h2><BarChart rows={a.transitions.map(([label, count]) => ({ label, count }))} /></div>
        <div className="card"><h2>Audit Health</h2><div className="metric-list">
          <div className="metric-row"><span>Audit records</span><strong>{a.auditRecords}</strong></div>
          <div className="metric-row"><span>Tracked tickets</span><strong>{a.total}</strong></div>
          <div className="metric-row"><span>Departments tracked</span><strong>4</strong></div>
        </div></div>
      </div>}

      <div className="card analytics-note"><strong>Audit-backed analytics</strong><p className="muted">Month and shed filters apply to the live Firestore ticket population. All KPI, chart, PDI quality and workflow values are recalculated from the selected scope.</p></div>
    </section>
  )
}
