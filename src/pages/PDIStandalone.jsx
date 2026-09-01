import { useEffect, useMemo, useState } from 'react'
import { PDI_RESULTS, SHEDS, STATUSES, STATUS_LABELS } from '../config.js'
import { subscribeLogs, subscribeTickets, updateTicket } from '../services.js'
import { subscribeInspectors } from '../inspectors.js'
import { useAuth } from '../auth.jsx'
import TicketDetail, { TicketLink } from '../components/TicketDetail.jsx'
import { BatchReinspectionRequest } from '../components/BatchReinspection.jsx'
import PDIPrintSlip from '../components/PDIPrintSlip.jsx'

const tv = v => v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0

function Table({ tickets, action, onOpen }) {
  return <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Type</th><th>Item Code</th><th>Shed</th><th>Customer</th><th>Destination</th><th>Qty</th><th>Status</th><th>Action</th></tr></thead><tbody>{tickets.map(t => <tr key={t.id}><td><TicketLink ticket={t} onOpen={onOpen}/></td><td><span className={`badge ${t.ticketType}`}>{t.ticketType}</span></td><td className="strong">{t.itemCode || '—'}</td><td><span className="shed-chip">{t.shed || '—'}</span></td><td>{t.customerName}</td><td>{t.destinationBranch || t.destinationCompany || '—'}</td><td>{t.qty}</td><td>{STATUS_LABELS[t.currentStatus] || t.currentStatus || '—'}</td><td>{action ? action(t) : '—'}</td></tr>)}</tbody></table></div>
}

function useData() {
  const [tickets, setTickets] = useState([])
  const [logs, setLogs] = useState([])
  useEffect(() => subscribeTickets(setTickets), [])
  useEffect(() => subscribeLogs(setLogs), [])
  return { tickets, logs }
}

function PDIHistory({ tickets, logs, onOpen }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [action, setAction] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const dl = useMemo(() => logs.filter(l => l.module === 'pdi' || l.role === 'pdi'), [logs])
  const actions = useMemo(() => [...new Set(dl.map(l => l.action).filter(Boolean))].sort(), [dl])
  const rows = useMemo(() => tickets.filter(t => {
    const activity = dl.filter(l => l.ticketId === t.id || l.ticketId === t.ticketId)
    return activity.some(l => l.action === 'pdi_inspection_completed')
  }).filter(t => {
    const hay = [t.ticketId, t.customerName, t.destinationBranch, t.itemCode, t.shed].join(' ').toLowerCase()
    if (search && !hay.includes(search.toLowerCase())) return false
    if (status !== 'all' && t.currentStatus !== status) return false
    const activity = dl.filter(l => l.ticketId === t.id || l.ticketId === t.ticketId)
    if (action !== 'all' && !activity.some(l => l.action === action)) return false
    const latest = Math.max(0, ...activity.map(l => tv(l.createdAt)))
    if (from && latest < new Date(`${from}T00:00:00`).getTime()) return false
    if (to && latest > new Date(`${to}T23:59:59`).getTime()) return false
    return true
  }), [tickets, dl, search, status, action, from, to])

  function pdiDoneLogFor(ticket) {
    return dl.filter(l => (l.ticketId === ticket.id || l.ticketId === ticket.ticketId) && l.action === 'pdi_inspection_completed').reduce((x, y) => tv(y.createdAt) > tv(x?.createdAt) ? y : x, null)
  }

  return <section className="page"><div className="eyebrow">PDI · AUDIT</div><h1>PDI History</h1><p className="muted">Completed PDI inspections with search, filters and printable material slips.</p><div className="card"><div className="filter-bar"><input placeholder="Search ticket, customer, branch, item, shed…" value={search} onChange={e => setSearch(e.target.value)}/><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select><select value={action} onChange={e => setAction(e.target.value)}><option value="all">All actions</option>{actions.map(a => <option key={a}>{a}</option>)}</select><label className="compact-field">From<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label className="compact-field">To<input type="date" value={to} onChange={e => setTo(e.target.value)}/></label><button className="secondary" onClick={() => { setSearch(''); setStatus('all'); setAction('all'); setFrom(''); setTo('') }}>Reset</button></div><div className="filter-result">Showing <strong>{rows.length}</strong> completed PDI ticket(s)</div><div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Item Code</th><th>Shed</th><th>Customer</th><th>Destination</th><th>Status</th><th>PDI Done</th><th>Print</th></tr></thead><tbody>{rows.map(t => { const pdiDoneLog = pdiDoneLogFor(t); return <tr key={t.id}><td><TicketLink ticket={t} onOpen={onOpen}/></td><td>{t.itemCode || '—'}</td><td>{t.shed || '—'}</td><td>{t.customerName || '—'}</td><td>{t.destinationBranch || t.destinationCompany || '—'}</td><td>{STATUS_LABELS[t.currentStatus] || t.currentStatus || '—'}</td><td>{pdiDoneLog?.createdAt?.toDate ? pdiDoneLog.createdAt.toDate().toLocaleString() : pdiDoneLog?.createdAt ? new Date(pdiDoneLog.createdAt).toLocaleString() : 'Recorded'}</td><td><PDIPrintSlip ticket={t} pdiDoneLog={pdiDoneLog || { createdAt: t.pdi?.completedAt || new Date() }}/></td></tr> })}</tbody></table></div></div></section>
}

export default function PDI({ historyOnly = false }) {
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
  const [completed, setCompleted] = useState(null)

  useEffect(() => subscribeInspectors(list => setInspectors(list.map(x => x.name).filter(Boolean))), [])

  if (historyOnly) return <><PDIHistory tickets={tickets} logs={logs} onOpen={setDetail}/><TicketDetail ticket={detail} onClose={() => setDetail(null)}/></>

  const queue = tickets.filter(t => t.currentStatus === STATUSES.READY_FOR_PDI)

  function openInspection(t) {
    setSelected(t)
    setCompleted(null)
    setTotal(String(t.qty || ''))
    setDamage('0')
    setRemarks('')
    setResult(PDI_RESULTS[0])
    setInspector(t.pdi?.inspectorName || '')
  }

  async function submit(e) {
    e.preventDefault()
    const checked = Number(total)
    const damaged = Math.min(checked, Number(damage))
    const allDamage = damaged > 0 && damaged === checked
    const inspectorValue = inspector.trim()
    if (!inspectorValue || !selected) return
    const completedAt = new Date()
    await updateTicket(selected.id, { currentStatus: allDamage ? STATUSES.READY_FOR_PDI : STATUSES.READY_FOR_DISPATCH, currentModule: allDamage ? 'pdi' : 'warehouse', previousStatus: selected.currentStatus, pdi: { result, totalChecked: checked, defective: damaged, approved: checked - damaged, remarks, inspectorName: inspectorValue, reinspectionRequested: false, completedAt } }, profile, 'pdi_inspection_completed', { module: 'pdi', previousStatus: selected.currentStatus, newStatus: allDamage ? STATUSES.READY_FOR_PDI : STATUSES.READY_FOR_DISPATCH, details: `PDI inspection completed by ${inspectorValue}: ${result}.`, metadata: { result, checked, damaged, remarks, inspectorName: inspectorValue } })
    setCompleted({ ticket: { ...selected, pdi: { ...(selected.pdi || {}), result, totalChecked: checked, defective: damaged, approved: checked - damaged, remarks, inspectorName: inspectorValue, completedAt } }, pdiDoneLog: { createdAt: completedAt } })
    setSelected(null)
  }

  return <section className="page"><div className="eyebrow">PDI INSPECTION</div><h1>Inspection Queue</h1><div className="card"><h2>Inspection Queue</h2><Table tickets={queue} onOpen={setDetail} action={t => <button className="primary" onClick={() => openInspection(t)}>Inspect</button>}/></div>{completed && <div className="card success-card"><div className="card-head"><div><div className="eyebrow">PDI COMPLETED</div><h2>Inspection Done Successfully</h2><p className="muted">Print the PDI slip now and attach it to the inspected material.</p></div><PDIPrintSlip ticket={completed.ticket} pdiDoneLog={completed.pdiDoneLog}/></div><div className="dispatch-ticket-strip"><span><small>Ticket</small><strong>{completed.ticket.ticketId}</strong></span><span><small>Customer</small><strong>{completed.ticket.customerName || '—'}</strong></span><span><small>Destination</small><strong>{completed.ticket.destinationBranch || completed.ticket.destinationCompany || '—'}</strong></span></div></div>}{selected && <div className="card pdi-inspection-card"><div className="inspection-head"><div><div className="eyebrow">QUALITY CONTROL</div><h2>Inspection — {selected.ticketId}</h2><p className="muted">Record the inspector, checked quantity, damage and final PDI result.</p></div><span className="badge">INSPECTION</span></div><div className="dispatch-ticket-strip"><span><small>Ticket</small><strong>{selected.ticketId}</strong></span><span><small>Item Code</small><strong>{selected.itemCode || '—'}</strong></span><span><small>Quantity</small><strong>{selected.qty || '—'}</strong></span></div><form className="form-grid" onSubmit={submit}><label>Inspector Name<select value={inspector} onChange={e => setInspector(e.target.value)} required><option value="">Select inspector</option>{inspectors.map(name => <option value={name} key={name}>{name}</option>)}</select></label><label>PDI Result<select value={result} onChange={e => setResult(e.target.value)}>{PDI_RESULTS.map(x => <option key={x}>{x}</option>)}</select></label><label>Total Checked<input type="number" min="0" value={total} onChange={e => setTotal(e.target.value)} required/></label><label>Defective / Damaged<input type="number" min="0" value={damage} onChange={e => setDamage(e.target.value)} required/></label><label className="wide-field">Detailed Remarks<textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows="4" placeholder="Inspection observations, damage details, approval notes…"/></label><div className="form-actions"><button className="primary">Inspection Done</button><button type="button" className="secondary" onClick={() => setSelected(null)}>Cancel</button></div></form>{Number(damage) > 0 && Number(damage) === Number(total) && <BatchReinspectionRequest ticket={selected} onDone={() => setSelected(null)}/>}</div>}<TicketDetail ticket={detail} onClose={() => setDetail(null)}/></section>
}
