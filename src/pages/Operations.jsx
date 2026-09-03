import { useEffect, useMemo, useState } from 'react'
import { DISPATCH_METHODS, PDI_RESULTS, SHEDS, STATUSES, STATUS_LABELS } from '../config.js'
import { getModuleFromStatus, getNextStatus, subscribeLogs, subscribeTickets, updateTicket } from '../services.js'
import { subscribeInspectors } from '../inspectors.js'
import { useAuth } from '../auth.jsx'
import TicketDetail, { TicketLink } from '../components/TicketDetail.jsx'
import { BatchReinspectionRequest, WarehouseBatchResponse } from '../components/BatchReinspection.jsx'
import PDIPrintSlip from '../components/PDIPrintSlip.jsx'

const tv = value => value?.toMillis ? value.toMillis() : value ? new Date(value).getTime() : 0

function Table({ tickets, action, onOpen }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Ticket</th><th>Type</th><th>Item Code</th><th>Shed</th><th>Customer</th><th>Destination</th><th>Qty</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {tickets.map(ticket => (
            <tr key={ticket.id}>
              <td><TicketLink ticket={ticket} onOpen={onOpen} /></td>
              <td><span className={`badge ${ticket.ticketType}`}>{ticket.ticketType}</span></td>
              <td className="strong">{ticket.itemCode || '—'}</td>
              <td><span className="shed-chip">{ticket.shed || '—'}</span></td>
              <td>{ticket.customerName || '—'}</td>
              <td>{ticket.destinationBranch || ticket.destinationCompany || '—'}</td>
              <td>{ticket.qty ?? '—'}</td>
              <td>{STATUS_LABELS[ticket.currentStatus] || ticket.currentStatus || '—'}</td>
              <td>{action ? action(ticket) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function useData() {
  const [tickets, setTickets] = useState([])
  const [logs, setLogs] = useState([])
  useEffect(() => subscribeTickets(setTickets), [])
  useEffect(() => subscribeLogs(setLogs), [])
  return { tickets, logs }
}

function History({ module, title, tickets, logs, onOpen }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [action, setAction] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const departmentLogs = useMemo(() => logs.filter(log => log.module === module || log.role === module), [logs, module])
  const actions = useMemo(() => [...new Set(departmentLogs.map(log => log.action).filter(Boolean))].sort(), [departmentLogs])
  const rows = useMemo(() => tickets.filter(ticket => departmentLogs.some(log => log.ticketId === ticket.id)).filter(ticket => {
    const haystack = [ticket.ticketId, ticket.customerName, ticket.destinationBranch, ticket.itemCode, ticket.shed].join(' ').toLowerCase()
    if (search && !haystack.includes(search.toLowerCase())) return false
    if (status !== 'all' && ticket.currentStatus !== status) return false
    const activity = departmentLogs.filter(log => log.ticketId === ticket.id)
    if (action !== 'all' && !activity.some(log => log.action === action)) return false
    const latest = Math.max(0, ...activity.map(log => tv(log.createdAt)))
    if (from && latest < new Date(`${from}T00:00:00`).getTime()) return false
    if (to && latest > new Date(`${to}T23:59:59`).getTime()) return false
    return true
  }), [tickets, departmentLogs, search, status, action, from, to])

  return (
    <section className="page">
      <div className="eyebrow">{module.toUpperCase()} · AUDIT</div>
      <h1>{title} History</h1>
      <p className="muted">Department history with search, status, action and date filters.</p>
      <div className="card">
        <div className="filter-bar">
          <input placeholder="Search ticket, customer, branch, item, shed…" value={search} onChange={event => setSearch(event.target.value)} />
          <select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>
          <select value={action} onChange={event => setAction(event.target.value)}><option value="all">All actions</option>{actions.map(item => <option key={item}>{item}</option>)}</select>
          <label className="compact-field">From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
          <label className="compact-field">To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
          <button className="secondary" onClick={() => { setSearch(''); setStatus('all'); setAction('all'); setFrom(''); setTo('') }}>Reset</button>
        </div>
        <div className="filter-result">Showing <strong>{rows.length}</strong> department tickets</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ticket</th><th>Item Code</th><th>Shed</th><th>Status</th><th>Actions</th><th>Latest Action</th><th>Latest Timestamp</th>{module === 'pdi' && <th>Slip</th>}</tr></thead>
            <tbody>
              {rows.map(ticket => {
                const activity = departmentLogs.filter(log => log.ticketId === ticket.id)
                const latest = activity.reduce((best, log) => tv(log.createdAt) > tv(best?.createdAt) ? log : best, null)
                const pdiDoneLog = activity.filter(log => log.action === 'pdi_inspection_completed').reduce((best, log) => tv(log.createdAt) > tv(best?.createdAt) ? log : best, null)
                return (
                  <tr key={ticket.id}>
                    <td><TicketLink ticket={ticket} onOpen={onOpen} /></td>
                    <td>{ticket.itemCode || '—'}</td>
                    <td>{ticket.shed || '—'}</td>
                    <td>{STATUS_LABELS[ticket.currentStatus] || ticket.currentStatus || '—'}</td>
                    <td>{activity.length}</td>
                    <td>{latest?.action || '—'}</td>
                    <td>{latest?.createdAt?.toDate ? latest.createdAt.toDate().toLocaleString() : 'Awaiting server timestamp'}</td>
                    {module === 'pdi' && <td>{pdiDoneLog ? <PDIPrintSlip ticket={ticket} pdiDoneLog={pdiDoneLog} /> : <span className="muted">—</span>}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function Warehouse({ historyOnly = false, view = 'all' }) {
  const { profile } = useAuth()
  const { tickets, logs } = useData()
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [shed, setShed] = useState('ALL')
  const [method, setMethod] = useState('Dedicated')
  const [vehicle, setVehicle] = useState('')
  const [loadNumber, setLoadNumber] = useState('')
  const [dispatchFO, setDispatchFO] = useState('')
  const [courier, setCourier] = useState('')
  const [tracking, setTracking] = useState('')

  if (historyOnly) return <><History module="warehouse" title="Warehouse" tickets={tickets} logs={logs} onOpen={setDetail} /><TicketDetail ticket={detail} onClose={() => setDetail(null)} /></>

  const queue = tickets.filter(ticket => shed === 'ALL' || ticket.shed === shed)
  const pending = queue.filter(ticket => ticket.currentStatus === STATUSES.PENDING_WAREHOUSE)
  const ready = queue.filter(ticket => ticket.currentStatus === STATUSES.READY_FOR_DISPATCH)
  const reinspection = queue.filter(ticket => ticket.currentStatus === STATUSES.PENDING_WAREHOUSE && ticket.pdi?.reinspectionRequested)

  async function move(ticket) {
    const next = getNextStatus(ticket)
    if (!next) throw new Error('No next workflow step is available for this ticket.')
    await updateTicket(ticket.id, { currentStatus: next, currentModule: getModuleFromStatus(next), previousStatus: ticket.currentStatus }, profile, 'warehouse_movement_completed', { module: 'warehouse', previousStatus: ticket.currentStatus, newStatus: next, details: next === STATUSES.FORWARD_ORDER_PENDING ? 'Warehouse movement completed. Ticket routed to CRM Forward Order desk.' : 'Warehouse movement completed.' })
  }

  function openDispatch(ticket) {
    setSelected(ticket)
    setVehicle('')
    setLoadNumber(ticket.dispatch?.loadNumber || '')
    setDispatchFO(ticket.forwardOrder?.forwardingFoNumber || ticket.forwardingFoNumber || ticket.freightOrderNo || ticket.dispatch?.freightOrderNo || '')
    setCourier('')
    setTracking('')
  }

  async function dispatch(event) {
    event.preventDefault()
    if (method === 'Dedicated') {
      if (!vehicle || !loadNumber || !dispatchFO) return
    } else if (!courier || !tracking) return
    const isForwarded = Boolean(selected?.forwardOrder?.forwardingFoNumber || selected?.forwardingFoNumber)
    await updateTicket(selected.id, {
      currentStatus: STATUSES.LOGISTICS_PENDING,
      currentModule: 'logistics',
      previousStatus: selected.currentStatus,
      dispatch: {
        ...(selected.dispatch || {}),
        method,
        vehicleNumber: method === 'Dedicated' ? vehicle : '',
        loadNumber: method === 'Dedicated' ? loadNumber : '',
        freightOrderNo: method === 'Dedicated' ? dispatchFO : '',
        courierName: method === 'Courier' ? courier : '',
        trackingId: method === 'Courier' ? tracking : '',
        dispatchedAt: new Date()
      }
    }, profile, 'warehouse_dispatch_completed', {
      module: 'warehouse',
      previousStatus: selected.currentStatus,
      newStatus: STATUSES.LOGISTICS_PENDING,
      details: `Dispatch completed by ${method}.`,
      metadata: { method, vehicle, loadNumber, freightOrderNo: dispatchFO, courier, tracking, forwardingOrder: isForwarded }
    })
    setSelected(null)
  }

  return (
    <section className="page">
      <div className="page-head">
        <div><div className="eyebrow">WAREHOUSING · TEAM QUEUE</div><h1>Warehouse Operations</h1><p className="muted">Filter the live queue by shed and work only your assigned operational tickets.</p></div>
        <div className="queue-filter"><span>VIEW SHED</span><select value={shed} onChange={event => setShed(event.target.value)}><option value="ALL">All Sheds</option>{SHEDS.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
      </div>
      {(view === 'all' || view === 'movement') && <div className="card"><div className="card-head"><div><h2>Pending Movement</h2><p className="muted">{pending.length} ticket(s) · {shed === 'ALL' ? 'All sheds' : `Shed ${shed}`}</p></div></div><Table tickets={pending} onOpen={setDetail} action={ticket => <button className="primary" onClick={() => move(ticket)}>Mark Moved</button>} /></div>}
      {reinspection.length > 0 && <div className="card reinspection-alert"><h2>PDI Reinspection Requests</h2><p className="muted">These tickets need a new batch or a no-stock response from Warehouse.</p><Table tickets={reinspection} onOpen={setDetail} action={ticket => <button className="primary" onClick={() => setSelected({ ...ticket, _batchResponse: true })}>Respond</button>} /></div>}
      {(view === 'all' || view === 'dispatch') && <div className="card"><h2>Ready for Dispatch</h2><Table tickets={ready} onOpen={setDetail} action={ticket => <button className="primary" onClick={() => openDispatch(ticket)}>Dispatch Done</button>} /></div>}
      {selected?._batchResponse && <div className="card"><WarehouseBatchResponse ticket={selected} onDone={() => setSelected(null)} /></div>}
      {selected && !selected._batchResponse && <div className="card dispatch-card">
        <div className="dispatch-head"><div><div className="eyebrow">WAREHOUSE → LOGISTICS</div><h2>Dispatch Done</h2><p className="muted">Complete the physical dispatch details before handing the ticket to Logistics.</p></div><span className={`badge ${selected.ticketType}`}>{selected.ticketType}</span></div>
        <div className="dispatch-ticket-strip"><span><small>Ticket</small><strong>{selected.ticketId}</strong></span><span><small>Item Code</small><strong>{selected.itemCode || '—'}</strong></span><span><small>Shed</small><strong>{selected.shed || '—'}</strong></span><span><small>FO Source</small><strong>{selected.forwardOrder?.forwardingFoNumber ? 'CRM Forwarding FO' : selected.freightOrderNo || 'Ticket FO'}</strong></span></div>
        <form className="form-grid" onSubmit={dispatch}>
          <label>Dispatch Method<select value={method} onChange={event => setMethod(event.target.value)}>{DISPATCH_METHODS.map(item => <option key={item}>{item}</option>)}</select></label>
          {method === 'Dedicated' ? <>
            <label>Vehicle Number<input value={vehicle} onChange={event => setVehicle(event.target.value)} placeholder="Enter vehicle number" required /></label>
            <label>Load Number<input value={loadNumber} onChange={event => setLoadNumber(event.target.value)} placeholder="Enter load number" required /></label>
            <label>FO Number{selected.forwardOrder?.forwardingFoNumber && <small className="muted"> · Forwarding FO fetched from CRM</small>}<input value={dispatchFO} onChange={event => setDispatchFO(event.target.value)} placeholder="Enter freight order number" required /></label>
          </> : <>
            <label>Courier Name<input value={courier} onChange={event => setCourier(event.target.value)} required /></label>
            <label>Tracking ID<input value={tracking} onChange={event => setTracking(event.target.value)} required /></label>
          </>}
          <div className="form-actions"><button className="primary">Submit Dispatch</button><button type="button" className="secondary" onClick={() => setSelected(null)}>Cancel</button></div>
        </form>
      </div>}
      <TicketDetail ticket={detail} onClose={() => setDetail(null)} />
    </section>
  )
}

export function PDI({ historyOnly = false }) {
  const { profile } = useAuth()
  const { tickets, logs } = useData()
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [result, setResult] = useState(PDI_RESULTS[0])
  const [total, setTotal] = useState('')
  const [damage, setDamage] = useState('0')
  const [remarks, setRemarks] = useState('')
  const [inspector, setInspector] = useState('')
  const [inspectors, setInspectors] = useState([])
  useEffect(() => subscribeInspectors(list => setInspectors(list.map(item => item.name).filter(Boolean))), [])
  if (historyOnly) return <><History module="pdi" title="PDI" tickets={tickets} logs={logs} onOpen={setDetail} /><TicketDetail ticket={detail} onClose={() => setDetail(null)} /></>
  const queue = tickets.filter(ticket => ticket.currentStatus === STATUSES.READY_FOR_PDI)
  function openInspection(ticket) { setSelected(ticket); setTotal(String(ticket.qty || '')); setDamage('0'); setRemarks(''); setResult(PDI_RESULTS[0]); setInspector(ticket.pdi?.inspectorName || '') }
  async function submit(event) {
    event.preventDefault()
    const checked = Number(total)
    const damaged = Math.min(checked, Number(damage))
    const allDamage = damaged > 0 && damaged === checked
    const inspectorValue = inspector.trim()
    if (!inspectorValue) return
    await updateTicket(selected.id, { currentStatus: allDamage ? STATUSES.READY_FOR_PDI : STATUSES.READY_FOR_DISPATCH, currentModule: allDamage ? 'pdi' : 'warehouse', previousStatus: selected.currentStatus, pdi: { result, totalChecked: checked, defective: damaged, approved: checked - damaged, remarks, inspectorName: inspectorValue, reinspectionRequested: false } }, profile, 'pdi_inspection_completed', { module: 'pdi', previousStatus: selected.currentStatus, newStatus: allDamage ? STATUSES.READY_FOR_PDI : STATUSES.READY_FOR_DISPATCH, details: `PDI inspection completed by ${inspectorValue}: ${result}.`, metadata: { result, checked, damaged, remarks, inspectorName: inspectorValue } })
    setSelected(null)
  }
  return <section className="page"><div className="eyebrow">PDI INSPECTION</div><h1>Inspection Queue</h1><div className="card"><h2>Inspection Queue</h2><Table tickets={queue} onOpen={setDetail} action={ticket => <button className="primary" onClick={() => openInspection(ticket)}>Inspect</button>} /></div>{selected && <div className="card pdi-inspection-card"><div className="inspection-head"><div><div className="eyebrow">QUALITY CONTROL</div><h2>Inspection — {selected.ticketId}</h2><p className="muted">Record the inspector, checked quantity, damage and final PDI result.</p></div><span className="badge">INSPECTION</span></div><div className="dispatch-ticket-strip"><span><small>Ticket</small><strong>{selected.ticketId}</strong></span><span><small>Item Code</small><strong>{selected.itemCode || '—'}</strong></span><span><small>Quantity</small><strong>{selected.qty || '—'}</strong></span></div><form className="form-grid" onSubmit={submit}><label>Inspector Name<select value={inspector} onChange={event => setInspector(event.target.value)} required><option value="">Select inspector</option>{inspectors.map(name => <option value={name} key={name}>{name}</option>)}</select></label><label>PDI Result<select value={result} onChange={event => setResult(event.target.value)}>{PDI_RESULTS.map(item => <option key={item}>{item}</option>)}</select></label><label>Total Checked<input type="number" min="0" value={total} onChange={event => setTotal(event.target.value)} required /></label><label>Defective / Damaged<input type="number" min="0" value={damage} onChange={event => setDamage(event.target.value)} required /></label><label className="wide-field">Detailed Remarks<textarea value={remarks} onChange={event => setRemarks(event.target.value)} rows="4" placeholder="Inspection observations, damage details, approval notes…" /></label><div className="form-actions"><button className="primary">Save PDI Result</button><button type="button" className="secondary" onClick={() => setSelected(null)}>Cancel</button></div></form>{Number(damage) > 0 && Number(damage) === Number(total) && <BatchReinspectionRequest ticket={selected} onDone={() => setSelected(null)} />}</div>}<TicketDetail ticket={detail} onClose={() => setDetail(null)} /></section>
}

export function Logistics({ historyOnly = false, view = 'all' }) {
  const { profile } = useAuth()
  const { tickets, logs } = useData()
  const [eta, setEta] = useState('')
  const [actual, setActual] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  if (historyOnly) return <><History module="logistics" title="Logistics" tickets={tickets} logs={logs} onOpen={setDetail} /><TicketDetail ticket={detail} onClose={() => setDetail(null)} /></>
  const incoming = tickets.filter(ticket => ticket.currentStatus === STATUSES.LOGISTICS_PENDING)
  const transit = tickets.filter(ticket => ticket.currentStatus === STATUSES.IN_TRANSIT)
  async function submitEta(event) { event.preventDefault(); if (!eta) return; await updateTicket(selected.id, { currentStatus: STATUSES.IN_TRANSIT, currentModule: 'logistics', previousStatus: selected.currentStatus, logistics: { ...(selected.logistics || {}), etaDate: eta, etaSubmittedAt: new Date() } }, profile, 'logistics_eta_submitted', { module: 'logistics', previousStatus: selected.currentStatus, newStatus: STATUSES.IN_TRANSIT, details: `ETA ${eta} submitted.`, metadata: { etaDate: eta } }); setSelected(null) }
  async function close(event) { event.preventDefault(); if (!actual) return; await updateTicket(selected.id, { currentStatus: STATUSES.CLOSED, currentModule: 'closed', previousStatus: selected.currentStatus, logistics: { ...(selected.logistics || {}), actualBranchReportingDate: actual } }, profile, 'logistics_ticket_closed', { module: 'logistics', previousStatus: selected.currentStatus, newStatus: STATUSES.CLOSED, details: `Ticket closed; branch reporting date: ${actual}.`, metadata: { actualBranchReportingDate: actual } }); setSelected(null) }
  return <section className="page"><div className="eyebrow">LOGISTICS</div><h1>Logistics Operations</h1>{(view === 'all' || view === 'pending') && <div className="card"><h2>Logistics Queue</h2><Table tickets={incoming} onOpen={setDetail} action={ticket => <button className="primary" onClick={() => { setSelected(ticket); setEta(ticket.logistics?.etaDate || '') }}>Add ETA</button>} /></div>}{(view === 'all' || view === 'transit') && <div className="card"><h2>In Transit</h2><Table tickets={transit} onOpen={setDetail} action={ticket => <button className="primary" onClick={() => { setSelected(ticket); setActual('') }}>Close Ticket</button>} /></div>}{(view === 'all' || view === 'closed') && <div className="card"><h2>Recently Closed</h2><Table tickets={tickets.filter(ticket => ticket.currentStatus === STATUSES.CLOSED).slice(0, 50)} onOpen={setDetail} /></div>}{selected && <div className="card"><h2>{selected.currentStatus === STATUSES.LOGISTICS_PENDING ? 'Submit ETA' : 'Close Ticket'} — {selected.ticketId}</h2><form className="form-grid" onSubmit={selected.currentStatus === STATUSES.LOGISTICS_PENDING ? submitEta : close}>{selected.currentStatus === STATUSES.LOGISTICS_PENDING && <label>ETA Date<input type="date" value={eta} onChange={event => setEta(event.target.value)} required /></label>}{selected.currentStatus !== STATUSES.LOGISTICS_PENDING && <label>Branch Reporting Actual Date<input type="date" value={actual} onChange={event => setActual(event.target.value)} required /></label>}<div className="form-actions"><button className="primary">{selected.currentStatus === STATUSES.LOGISTICS_PENDING ? 'Submit ETA' : 'Submit & Close Ticket'}</button><button type="button" className="secondary" onClick={() => setSelected(null)}>Cancel</button></div></form></div>}<TicketDetail ticket={detail} onClose={() => setDetail(null)} /></section>
}
