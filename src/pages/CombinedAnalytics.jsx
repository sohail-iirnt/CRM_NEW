import { useEffect, useMemo, useState } from 'react'
import { STATUSES, STATUS_LABELS } from '../config.js'
import { subscribeAnalyticsRules, subscribeLogs, subscribeTickets } from '../services.js'
import TicketDetail, { TicketLink } from '../components/TicketDetail.jsx'
import './combined-analytics.css'

const DAY = 86400000
const stamp = value => {
  if (!value) return 0
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  if (typeof value === 'number') return value
  const raw = String(value)
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (dateOnly) return Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  const parsed = new Date(raw).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}
const daysBetween = (a, b) => stamp(a) && stamp(b) ? Math.max(0, (stamp(b) - stamp(a)) / DAY) : null
const fmtDate = value => stamp(value) ? new Date(stamp(value)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDays = value => value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)} days`
const isClosed = ticket => ticket.currentStatus === STATUSES.CLOSED
const isActiveTransit = ticket => !isClosed(ticket) && Boolean(ticket.dispatch?.dispatchedAt || ticket.dispatchedDate || ticket.dispatchDate || ticket.dispatch?.dispatchDate)
const ticketName = ticket => ticket.ticketId || ticket.id
const bucket3 = n => n == null ? 'Missing dates' : n < 2 ? '0–1 days' : n < 3 ? '2–3 days' : '3+ days'
const endBucket = n => n == null ? 'Missing dates' : n <= 3 ? '0–3 days' : n <= 7 ? '3–7 days' : n <= 10 ? '7–10 days' : n <= 15 ? '10–15 days' : '15+ days'
const customBucket = n => n == null || !Number.isFinite(n) ? 'Missing event timestamps' : n < 2 ? '0–1 days' : n < 4 ? '2–3 days' : n < 8 ? '4–7 days' : n < 11 ? '8–10 days' : n < 16 ? '11–15 days' : '16+ days'
const CUSTOM_BUCKET_LABELS = ['0–1 days','2–3 days','4–7 days','8–10 days','11–15 days','16+ days','Missing event timestamps']
const colors = ['#4e6df5', '#11a98a', '#f0a43c', '#d95d76', '#8b68d9']
const esc = value => String(value ?? '').replace(/"/g, '""')
function exportCsv(filename, rows) {
  const blob = new Blob(['\ufeff' + rows.map(row => row.map(value => '"' + esc(value) + '"').join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
function BucketChart({ title, subtitle, buckets, onPick, chartType = 'bar', color = '#4e6df5', emptyText = 'No tickets in this bucket yet' }) {
  const max = Math.max(1, ...buckets.map(item => item.count))
  const total = buckets.reduce((sum, item) => sum + item.count, 0)
  const gradient = (() => {
    let cursor = 0
    return buckets.map((item, index) => {
      const start = cursor
      cursor += total ? item.count / total * 100 : 0
      return `${colors[index % colors.length] || color} ${start}% ${cursor}%`
    }).join(', ')
  })()
  return <section className="ca-chart-card">
    <div className="ca-chart-heading"><div><span className="ca-kicker">CLICK A BUCKET TO DRILL DOWN</span><h3>{title}</h3><p>{subtitle}</p></div><span className="ca-total">{total} tickets</span></div>
    {chartType === 'pie' ? <div className="ca-pie-layout">
      <div className="ca-pie" role="img" aria-label={`${title}: ${total} tickets distributed across ${buckets.length} buckets`} style={{ background: total ? `conic-gradient(${gradient})` : '#edf1f7' }}><div><strong>{total}</strong><span>tickets</span></div></div>
      <div className="ca-pie-legend">{buckets.map((item, index) => <button type="button" className="ca-pie-legend-row" key={item.label} onClick={() => onPick(item.label)}><i style={{ background: colors[index % colors.length] || color }}/><span>{item.label}</span><strong>{item.count}</strong><small>{Math.round(item.count / Math.max(1, total) * 100)}%</small></button>)}</div>
    </div> : <div className="ca-bars">{buckets.map((item, index) => <button type="button" className="ca-bar-row" key={item.label} onClick={() => onPick(item.label)} title={`Open ${item.count} tickets in ${item.label}`}>
      <span className="ca-bar-label">{item.label}</span><span className="ca-bar-track"><i style={{ width: `${item.count / max * 100}%`, background: colors[index % colors.length] || color }} /></span><strong>{item.count}</strong><span className="ca-bar-percent">{Math.round(item.count / Math.max(1, total) * 100)}%</span>
    </button>)}</div>}
    {buckets.every(item => item.count === 0) && <div className="ca-empty">{emptyText}</div>}
  </section>
}
function TicketTable({ rows, onTicket }) {
  return <div className="table-wrap ca-ticket-table"><table><thead><tr><th>Ticket</th><th>Customer</th><th>Shed</th><th>Status</th><th>Assigned</th><th>Warehouse done</th><th>PDI done</th><th>Dispatch</th><th>ETA</th><th>Actual reporting</th><th>Cycle / Aging</th></tr></thead><tbody>{rows.map(row => <tr key={row.ticket.id}><td><TicketLink ticket={row.ticket} onOpen={onTicket} /></td><td>{row.ticket.customerName || '—'}</td><td>{row.ticket.shed || '—'}</td><td>{STATUS_LABELS[row.ticket.currentStatus] || row.ticket.currentStatus || '—'}</td><td>{fmtDate(row.d.assigned)}</td><td>{fmtDate(row.d.warehouse)}</td><td>{fmtDate(row.d.inspection)}</td><td>{fmtDate(row.d.dispatched)}</td><td>{fmtDate(row.d.eta)}</td><td>{fmtDate(row.d.actual)}</td><td>{fmtDays(row.duration)}</td></tr>)}</tbody></table></div>
}
function DrillModal({ title, rows, onClose, onTicket }) {
  return <div className="ca-modal-shade" onMouseDown={onClose}><section className="ca-modal" onMouseDown={event => event.stopPropagation()}><header><div><span className="ca-kicker">ANALYTICS DRILL-DOWN</span><h2>{title}</h2><p>{rows.length} matching tickets · Select a ticket to inspect its full record.</p></div><button className="secondary" onClick={onClose}>Close</button></header><TicketTable rows={rows} onTicket={onTicket}/></section></div>
}
const blankBuckets = labels => labels.map(label => ({ label, count: 0 }))
function countBuckets(rows, key, labels) {
  const result = blankBuckets(labels)
  for (const row of rows) { const found = result.find(item => item.label === key(row)); if (found) found.count += 1 }
  return result
}

export default function CombinedAnalytics() {
  const [tickets, setTickets] = useState([])
  const [logs, setLogs] = useState([])
  const [customRules, setCustomRules] = useState([])
  const [analyticsMode, setAnalyticsMode] = useState('system')
  const [customChartType, setCustomChartType] = useState(null)
  const [view, setView] = useState('chart')
  const [chartType, setChartType] = useState('bar')
  const [mode, setMode] = useState('combined')
  const [drill, setDrill] = useState(null)
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')
  useEffect(() => subscribeTickets(setTickets, error => setLoadError(error?.message || 'Could not load live tickets.')), [])
  useEffect(() => subscribeLogs(setLogs, error => setLoadError(error?.message || 'Could not load ticket audit dates.')), [])
  useEffect(() => subscribeAnalyticsRules(setCustomRules, error => setLoadError(error?.message || 'Could not load custom analytics rules.')), [])

  const data = useMemo(() => {
    const latestLog = (ticket, action) => logs.filter(log => log.ticketId === ticket.id && log.action === action).reduce((best, log) => stamp(log.createdAt) > stamp(best?.createdAt) ? log : best, null)
    return tickets.map(ticket => {
      const eventLogs = logs.filter(log => log.ticketId === ticket.id)
      const latestMatching = (...terms) => eventLogs.filter(log => terms.some(term => String(log.action || '').toLowerCase().includes(term))).reduce((best, log) => stamp(log.createdAt) > stamp(best?.createdAt) ? log : best, null)
      const statusAt = status => eventLogs.filter(log => log.newStatus === status).reduce((best, log) => stamp(log.createdAt) > stamp(best?.createdAt) ? log : best, null)?.createdAt || (ticket.currentStatus === status ? ticket.statusChangedAt : null)
      const warehouseLog = latestLog(ticket, 'warehouse_movement_completed')
      const pdiLog = latestLog(ticket, 'pdi_inspection_completed')
      const assigned = ticket.ticketAssignedDate || ticket.assignedDate || ticket.createdAt
      const warehouse = warehouseLog?.createdAt || ticket.warehouseMovedAt || ticket.warehouse?.completedAt || ticket.warehouseMovementDate
      const inspection = pdiLog?.createdAt || ticket.pdi?.inspectionDoneDate || ticket.pdi?.inspectedAt || ticket.pdi?.completedAt || ticket.inspectionDoneDate
      const dispatched = ticket.dispatch?.dispatchedAt || ticket.dispatchedDate || ticket.dispatchDate || ticket.dispatch?.dispatchDate
      const eta = ticket.logistics?.etaDate || ticket.logistics?.expectedEtaDate || ticket.etaDate || ticket.expectedEtaDate
      const actual = ticket.logistics?.actualBranchReportingDate || ticket.actualBranchReportingDate || ticket.branchReportingDate || ticket.actualReportingDate
      const eventTimes = {
        ticket_created: ticket.createdAt || latestMatching('ticket_created')?.createdAt,
        ticket_assigned: ticket.ticketAssignedDate || ticket.assignedDate || latestMatching('ticket_assigned','assigned')?.createdAt,
        warehouse_movement_completed: warehouse,
        received_for_pdi: latestMatching('received_for_pdi','pdi_queue','ready_for_pdi')?.createdAt || statusAt(STATUSES.READY_FOR_PDI),
        forward_order_completed: latestMatching('forward_order_completed','forwarding_order_completed')?.createdAt,
        pdi_inspection_completed: inspection,
        new_batch_provided: latestMatching('new_batch_provided','batch_provided','reinspection_batch')?.createdAt || ticket.pdi?.batches?.slice(-1)[0]?.allocatedAt,
        no_more_stock_available: latestMatching('no_more_stock_available','no_stock_reported','warehouse_no_stock')?.createdAt || (ticket.pdi?.latestBatchNoStock ? ticket.pdi?.batches?.slice(-1)[0]?.allocatedAt : null),
        warehouse_dispatch_completed: dispatched,
        logistics_updated: ticket.logistics?.updatedAt || ticket.logisticsUpdatedAt || latestMatching('logistics_expected_eta_completed','logistics_updated','eta_updated')?.createdAt,
        in_transit: statusAt(STATUSES.IN_TRANSIT),
        eta,
        actual_branch_reporting: actual,
        ticket_closed: statusAt(STATUSES.CLOSED) || (isClosed(ticket) ? ticket.statusChangedAt : null),
        pdi_no_stock_ticket_closed: latestMatching('pdi_no_stock_ticket_closed')?.createdAt || (ticket.pdi?.closedReason === 'no_stock' ? ticket.pdi?.completedAt : null)
      }
      for (const statusKey of Object.values(STATUSES)) eventTimes['status:'+statusKey] = statusAt(statusKey)
      const executionEligible = !isClosed(ticket) && Boolean(stamp(assigned) && stamp(inspection))
      const transitEligible = isActiveTransit(ticket)
      const closedEligible = isClosed(ticket) && Boolean(stamp(assigned) && stamp(actual))
      const warehouseDays = daysBetween(assigned, warehouse)
      const pdiDays = daysBetween(warehouse || assigned, inspection)
      const executionDays = daysBetween(assigned, inspection)
      const transitDays = daysBetween(dispatched, actual || new Date())
      const breachDays = stamp(eta) && (stamp(actual || new Date()) > stamp(eta)) ? (stamp(actual || new Date()) - stamp(eta)) / DAY : 0
      const remainingDays = stamp(eta) && !actual ? (stamp(eta) - Date.now()) / DAY : stamp(eta) && stamp(actual) && stamp(actual) <= stamp(eta) ? (stamp(eta) - stamp(actual)) / DAY : null
      const endDays = daysBetween(assigned, actual)
      return { ticket, d: { assigned, warehouse, inspection, dispatched, eta, actual }, eventTimes, executionEligible, transitEligible, closedEligible, warehouseDays, pdiDays, executionDays, transitDays, breachDays, remainingDays, endDays }
    })
  }, [tickets, logs])
  const filtered = useMemo(() => data.filter(row => !search || [row.ticket.ticketId, row.ticket.customerName, row.ticket.destinationBranch, row.ticket.itemCode, row.ticket.shed].join(' ').toLowerCase().includes(search.toLowerCase())), [data, search])
  const execution = filtered.filter(row => row.executionEligible)
  const transit = filtered.filter(row => row.transitEligible)
  const closed = filtered.filter(row => row.closedEligible)
  const customAnalytics = useMemo(() => customRules.filter(rule => rule.enabled !== false).map(rule => {
    const scopes = rule.scopes || ['all']
    const population = data.filter(row => scopes.includes('all') || (
      (scopes.includes('active') && !isClosed(row.ticket)) ||
      (scopes.includes('in_transit') && row.ticket.currentStatus === STATUSES.IN_TRANSIT) ||
      (scopes.includes('closed') && isClosed(row.ticket))
    ))
    const rows = population.map(row => {
      const from = row.eventTimes?.[rule.from]
      const to = row.eventTimes?.[rule.to]
      const duration = stamp(from) && stamp(to) ? Math.max(0, (stamp(to) - stamp(from)) / DAY) : null
      return { ...row, customFrom: from, customTo: to, duration }
    }).filter(row => rule.showMissing || row.duration != null)
    const labels = [...(rule.buckets || ['0-1','2-3','4-7','8-10','11-15','16+']).map(key => ({'0-1':'0–1 days','2-3':'2–3 days','4-7':'4–7 days','8-10':'8–10 days','11-15':'11–15 days','16+':'16+ days'}[key] || key)), ...(rule.showMissing ? ['Missing event timestamps'] : [])]
    const buckets = labels.map(label => ({label,count:rows.filter(row => customBucket(row.duration) === label).length}))
    return {rule,rows,buckets}
  }),[customRules,data])
  const executionWarehouseBuckets = countBuckets(execution.filter(row => row.warehouseDays != null), row => bucket3(row.warehouseDays), ['0–1 days', '2–3 days', '3+ days'])
  const executionPdiBuckets = countBuckets(execution.filter(row => row.pdiDays != null), row => bucket3(row.pdiDays), ['0–1 days', '2–3 days', '3+ days'])
  const breachBuckets = countBuckets(transit.filter(row => row.breachDays > 0), row => bucket3(row.breachDays), ['0–1 days', '2–3 days', '3+ days'])
  const remainingBuckets = countBuckets(transit.filter(row => row.breachDays <= 0 && row.remainingDays != null && row.remainingDays >= 0), row => row.remainingDays < 2 ? '1 day' : row.remainingDays < 4 ? '2–3 days' : '3+ days', ['1 day', '2–3 days', '3+ days'])
  const closedBuckets = countBuckets(closed, row => endBucket(row.endDays), ['0–3 days', '3–7 days', '7–10 days', '10–15 days', '15+ days'])
  const combinedBuckets = [
    { label: 'Execution cycle', count: execution.length, detail: 'Assigned → Inspection done', key: 'execution' },
    { label: 'In transit', count: transit.length, detail: 'Dispatch → Actual reporting / current age', key: 'transit' },
    { label: 'Closed end-to-end', count: closed.length, detail: 'Assigned → Actual branch reporting', key: 'closed' },
  ]
  const currentRows = mode === 'execution' ? execution : mode === 'transit' ? transit : mode === 'closed' ? closed : filtered
  const openCustomBucket = (item, label) => setDrill({ title: item.rule.name+' · '+label, rows: item.rows.filter(row => customBucket(row.duration) === label) })
  const openBucket = (group, label) => {
    let rows = []
    if (group === 'combined') rows = label === 'Execution cycle' ? execution : label === 'In transit' ? transit : closed
    if (group === 'warehouse') rows = execution.filter(row => row.warehouseDays != null && bucket3(row.warehouseDays) === label)
    if (group === 'pdi') rows = execution.filter(row => row.pdiDays != null && bucket3(row.pdiDays) === label)
    if (group === 'breach') rows = transit.filter(row => row.breachDays > 0 && bucket3(row.breachDays) === label)
    if (group === 'remaining') rows = transit.filter(row => row.breachDays <= 0 && row.remainingDays != null && row.remainingDays >= 0 && (row.remainingDays < 2 ? '1 day' : row.remainingDays < 4 ? '2–3 days' : '3+ days') === label)
    if (group === 'closed') rows = closed.filter(row => endBucket(row.endDays) === label)
    setDrill({ title: label, rows })
  }
  const exportRows = (rows) => [['Ticket ID','Customer','Shed','Status','Assigned Date','Warehouse Done Date','Inspection Done Date','Dispatch Done Date','ETA Date','Actual Reporting Date','Warehouse Days','PDI Days','Execution Days','Transit Days','Breach Days','Days Remaining To ETA','End-to-End Days'], ...rows.map(row => [ticketName(row.ticket), row.ticket.customerName, row.ticket.shed, STATUS_LABELS[row.ticket.currentStatus] || row.ticket.currentStatus, fmtDate(row.d.assigned), fmtDate(row.d.warehouse), fmtDate(row.d.inspection), fmtDate(row.d.dispatched), fmtDate(row.d.eta), fmtDate(row.d.actual), row.warehouseDays?.toFixed(2), row.pdiDays?.toFixed(2), row.executionDays?.toFixed(2), row.transitDays?.toFixed(2), row.breachDays?.toFixed(2), row.remainingDays?.toFixed(2), row.endDays?.toFixed(2)])]
  const title = mode === 'execution' ? 'Execution Chart' : mode === 'transit' ? 'In Transit Chart' : mode === 'closed' ? 'Closed End-to-End Chart' : 'Combined End-to-End Cycle'
  return <section className="page ca-page">
    <div className="ca-hero"><div><span className="ca-kicker">CRM SAIDHARA · OPERATIONS INTELLIGENCE</span><h1>Analytics <span>(New)</span></h1><p>One live view of execution, transit risk and completed end-to-end turnaround.</p><div className="ca-hero-meta"><span><i/> LIVE TICKET DATA</span><b>{tickets.length} total tickets</b><b>{logs.length} audit events</b></div></div><div className="ca-hero-art" aria-hidden="true"><div className="ca-art-ring ring-one"/><div className="ca-art-ring ring-two"/><div className="ca-art-core">↗</div><span className="ca-art-dot dot-one"/><span className="ca-art-dot dot-two"/><span className="ca-art-dot dot-three"/></div></div>
    <div className="ca-system-analytics" style={{display: analyticsMode === 'system' ? 'block' : 'none'}}>
    <div className="ca-toolbar"><label className="ca-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search ticket, customer, shed or branch…"/></label><div className="ca-view-switch"><button className={view === 'chart' && chartType === 'bar' ? 'active' : ''} onClick={() => { setView('chart'); setChartType('bar') }}>▥ Bar Chart</button><button className={view === 'chart' && chartType === 'pie' ? 'active' : ''} onClick={() => { setView('chart'); setChartType('pie') }}>◔ Pie Chart</button><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>▤ Table</button></div></div>
    <section className="ca-overview card"><div className="ca-section-title"><div><span className="ca-kicker">END-TO-END OVERVIEW</span><h2>Combined End to End Cycle</h2><p>Choose a cycle to explore its dedicated aging and breach analytics.</p></div><span className="ca-live-pill">● LIVE</span></div>
      {view === 'chart' ? <div className="ca-combined-grid">{combinedBuckets.map((item,index)=><button key={item.key} className={`ca-combined-card ca-tone-${index} ${mode === item.key ? 'selected' : ''}`} onClick={() => setMode(item.key)}><span className="ca-card-symbol">{['◷','➜','✓'][index]}</span><span className="ca-card-title">{item.label}</span><strong>{item.count}</strong><small>{item.detail}</small><span className="ca-card-link">Open detailed chart <b>↗</b></span></button>)}</div> : <div className="ca-combined-table"><table><thead><tr><th>Cycle</th><th>Timeline</th><th>Tickets</th><th>Action</th></tr></thead><tbody>{combinedBuckets.map(item=><tr key={item.key}><td>{item.label}</td><td>{item.detail}</td><td>{item.count}</td><td><button className="secondary" onClick={() => setMode(item.key)}>View chart</button></td></tr>)}</tbody></table></div>}
    </section>
    <div className="ca-cycle-buttons"><button className={mode === 'execution' ? 'active execution' : 'execution'} onClick={() => setMode('execution')}><span>01</span><b>View Execution Chart</b><small>Assignment → Inspection</small><i>↗</i></button><button className={mode === 'transit' ? 'active transit' : 'transit'} onClick={() => setMode('transit')}><span>02</span><b>View In Transit Chart</b><small>Dispatch → Actual reporting / ETA</small><i>↗</i></button><button className={mode === 'closed' ? 'active closed' : 'closed'} onClick={() => setMode('closed')}><span>03</span><b>View Closed End to End Chart</b><small>Assignment → Actual reporting</small><i>↗</i></button></div>
    <div className="ca-detail-head"><div><span className="ca-kicker">DETAILED CYCLE VIEW</span><h2>{title}</h2><p>{mode === 'execution' ? 'Open tickets with both assignment and inspection-completed dates. Closed tickets are excluded.' : mode === 'transit' ? 'Dispatched tickets excluding closed tickets, split by ETA breach and remaining time.' : mode === 'closed' ? 'Closed tickets with a valid assigned date and actual branch reporting date.' : 'Compare the live volume of all three lifecycle stages.'}</p></div><div className="ca-detail-actions"><span className="ca-count">{currentRows.length} tickets</span><button className="ca-export" onClick={() => exportCsv('crm-'+mode+'-analytics-'+new Date().toISOString().slice(0,10)+'.csv', exportRows(currentRows))}>↓ Export CSV</button></div></div>
    {loadError && <div className="notice">{loadError}</div>}
    {view === 'chart' ? <div className="ca-charts-grid">
      {mode === 'combined' && <BucketChart title="Combined cycle population" subtitle="Click a lifecycle segment to see the matching tickets." buckets={combinedBuckets.map(item => ({ label: item.label, count: item.count }))} onPick={label => openBucket('combined', label)} chartType={chartType} />}
      {(mode === 'execution') && <><BucketChart title="Warehouse bucket" subtitle="Ticket assigned date → warehouse movement completed." buckets={executionWarehouseBuckets} onPick={label => openBucket('warehouse', label)} chartType={chartType} color="#4e6df5"/><BucketChart title="PDI bucket" subtitle="Warehouse movement completed → PDI inspection done." buckets={executionPdiBuckets} onPick={label => openBucket('pdi', label)} chartType={chartType} color="#11a98a"/></>}
      {mode === 'transit' && <><BucketChart title="ETA breach aging" subtitle="Late tickets, bucketed by days beyond the promised ETA." buckets={breachBuckets} onPick={label => openBucket('breach', label)} chartType={chartType} color="#d95d76"/><BucketChart title="Time remaining to ETA" subtitle="Non-breached transit tickets bucketed by time left before ETA." buckets={remainingBuckets} onPick={label => openBucket('remaining', label)} chartType={chartType} color="#11a98a"/></>}
      {mode === 'closed' && <BucketChart title="Closed end-to-end aging" subtitle="Assignment date → actual branch reporting date." buckets={closedBuckets} onPick={label => openBucket('closed', label)} chartType={chartType} color="#8b68d9"/>}
    </div> : <div className="card ca-table-card"><div className="ca-table-heading"><h3>{title} · Ticket register</h3><span>Click a ticket ID to open its details.</span></div><TicketTable rows={currentRows} onTicket={setDetail}/></div>}
    <div className="ca-footnote">Aging is calculated from saved workflow timestamps. In-transit tickets that have passed ETA are counted as breached using today’s date until actual reporting is recorded.</div>
    </div>
    {analyticsMode === 'custom' && <section className="ca-custom-analytics">
      <div className="ca-custom-head"><div><span className="ca-kicker">ADMIN-DEFINED ANALYTICS</span><h2>Custom Analytics</h2><p>Live charts use the event/status rules configured in Admin → Set Analytics Rule. Click a bucket or pie legend to open the matching ticket list.</p></div><div className="ca-custom-controls"><button className={view==='chart' && (customChartType||'pie')==='bar'?'active':''} onClick={()=>{setView('chart');setCustomChartType('bar')}}>Bar Chart</button><button className={view==='chart' && (customChartType||'pie')==='pie'?'active':''} onClick={()=>{setView('chart');setCustomChartType('pie')}}>Pie Chart</button><button className={view==='table'?'active':''} onClick={()=>setView('table')}>Table</button><button className="ca-export" onClick={()=>exportCsv('crm-custom-analytics-'+new Date().toISOString().slice(0,10)+'.csv',[['Chart','Ticket ID','Customer','Status','From Timestamp','To Timestamp','Duration Days'],...customAnalytics.flatMap(item=>item.rows.map(row=>[item.rule.name,ticketName(row.ticket),row.ticket.customerName,STATUS_LABELS[row.ticket.currentStatus]||row.ticket.currentStatus,fmtDate(row.customFrom),fmtDate(row.customTo),row.duration?.toFixed(2)]))])}>↓ Export CSV</button></div></div>
      {!customAnalytics.length ? <div className="ca-custom-empty"><strong>No enabled custom analytics rules yet.</strong><span>Open Admin → Set Analytics Rule, create a chart, select its events/statuses and ticket scopes, then save it.</span></div> : <div className="ca-charts-grid">{customAnalytics.map(item=><section className="ca-custom-chart" key={item.rule.id}>
        {(view==='table' || (!customChartType && item.rule.chartType==='table')) ? <><div className="ca-chart-heading"><div><span className="ca-kicker">CUSTOM CYCLE · TABLE</span><h3>{item.rule.name}</h3><p>{item.rows.length} tickets · {item.rule.from} → {item.rule.to}</p></div><span className="ca-total">{item.rows.length} tickets</span></div><TicketTable rows={item.rows} onTicket={setDetail}/></> : <BucketChart title={item.rule.name} subtitle={`From ${item.rule.from.replace('status:','Status: ')} → ${item.rule.to.replace('status:','Status: ')} · ${item.rows.length} matching tickets`} buckets={item.buckets} onPick={label=>openCustomBucket(item,label)} chartType={customChartType||item.rule.chartType||'pie'} color="#4e6df5" emptyText="No tickets match this rule yet"/>}
      </section>)}</div>}
    </section>}
    <div className="ca-mode-switch" role="group" aria-label="Analytics mode"><button className={analyticsMode==='system'?'active':''} onClick={()=>{setAnalyticsMode('system');setDrill(null)}}><span>◷</span><b>SYSTEM COUNTED</b><small>Standard lifecycle analytics</small></button><button className={analyticsMode==='custom'?'active':''} onClick={()=>{setAnalyticsMode('custom');setDrill(null);setCustomChartType(null);setView('chart')}}><span>◔</span><b>CUSTOM ANALYTICS</b><small>Admin-defined event & status rules</small></button></div>
    {drill && <DrillModal title={drill.title} rows={drill.rows} onClose={() => setDrill(null)} onTicket={setDetail}/>}
    <TicketDetail ticket={detail} onClose={() => setDetail(null)}/>
  </section>
}
