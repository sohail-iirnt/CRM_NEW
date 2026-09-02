import { useMemo, useState } from 'react'
import { STATUSES } from '../config.js'
import { updateTicket } from '../services.js'
import { useAuth } from '../auth.jsx'

const tv = v => v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0
const fmt = v => tv(v) ? new Date(tv(v)).toLocaleString() : '—'

function getBatches(ticket) {
  return Array.isArray(ticket?.pdi?.batches) ? ticket.pdi.batches : []
}

function Context({ ticket, batchNumber }) {
  return <div className="batch-context">
    <div><small>Ticket</small><strong>{ticket.ticketId || ticket.id}</strong></div>
    <div><small>Item Code</small><strong>{ticket.itemCode || '—'}</strong></div>
    <div><small>Shed</small><strong>{ticket.shed || '—'}</strong></div>
    <div><small>Batch</small><strong>#{batchNumber}</strong></div>
  </div>
}

export function BatchReinspectionRequest({ ticket, onDone }) {
  const { profile } = useAuth()
  const [quantity, setQuantity] = useState(String(ticket?.qty || ''))
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  if (!ticket) return null
  const batches = getBatches(ticket)
  const nextBatch = batches.length + 1

  async function request(e) {
    e.preventDefault()
    if (Number(quantity) < 1) return
    setSaving(true)
    try {
      await updateTicket(ticket.id, {
        currentStatus: STATUSES.PENDING_WAREHOUSE,
        currentModule: 'warehouse',
        previousStatus: ticket.currentStatus,
        pdi: { ...(ticket.pdi || {}), reinspectionRequested: true, requestedQuantity: Number(quantity), requestRemarks: remarks, requestCount: nextBatch }
      }, profile, 'pdi_new_batch_requested', {
        module: 'pdi', previousStatus: ticket.currentStatus, newStatus: STATUSES.PENDING_WAREHOUSE,
        details: `PDI requested new batch #${nextBatch} for reinspection. Quantity: ${quantity}.`,
        metadata: { requestedQuantity: Number(quantity), requestCount: nextBatch, remarks }
      })
      onDone?.()
    } finally { setSaving(false) }
  }

  return <form className="batch-request" onSubmit={request}>
    <div className="batch-request-head"><div><div className="eyebrow">PDI → WAREHOUSE</div><h3>Request New Material Batch</h3><p className="muted">Batch history is retained for this ticket. Warehouse will allocate the next available batch and return it to PDI.</p></div><span className="badge">REQUEST #{nextBatch}</span></div>
    <Context ticket={ticket} batchNumber={nextBatch}/>
    <div className="batch-fields"><label>Quantity Requested<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label><label>Reason / PDI Remarks<textarea rows="4" value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="All material damaged. Please provide another batch for reinspection…" required/></label></div>
    <div className="batch-actions"><button className="primary" disabled={saving}>{saving?'Sending Request…':'Request New Batch'}</button></div>
  </form>
}

export function WarehouseBatchResponse({ ticket, onDone }) {
  const { profile } = useAuth()
  const [quantity, setQuantity] = useState(String(ticket?.pdi?.requestedQuantity || ticket?.qty || ''))
  const [noStock, setNoStock] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  if (!ticket) return null
  const batches = getBatches(ticket)
  const batchNumber = batches.length + 1

  const totals = useMemo(() => batches.reduce((a,b) => ({ allocated:a.allocated+Number(b.allocatedQty||0), checked:a.checked+Number(b.checkedQty||0), approved:a.approved+Number(b.approvedQty||0), defective:a.defective+Number(b.defectiveQty||0) }), {allocated:0,checked:0,approved:0,defective:0}), [batches])

  async function submit(e) {
    e.preventDefault()
    if (!noStock && Number(quantity) < 1) return
    setSaving(true)
    try {
      const action = noStock ? 'warehouse_no_more_stock_available' : 'warehouse_new_batch_provided'
      const batch = { batchNumber, allocatedQty:noStock?0:Number(quantity), checkedQty:0, approvedQty:0, defectiveQty:0, status:noStock?'NO_STOCK_REPORTED':'ALLOCATED', allocatedAt:new Date(), responseRemarks:remarks }
      await updateTicket(ticket.id, {
        currentStatus: STATUSES.READY_FOR_PDI,
        currentModule: 'pdi',
        previousStatus: ticket.currentStatus,
        pdi: { ...(ticket.pdi || {}), reinspectionRequested:false, requestedQuantity:noStock?0:Number(quantity), requestCount:batchNumber, latestBatchNumber:batchNumber, latestBatchQuantity:noStock?0:Number(quantity), latestBatchNoStock:noStock, batches:[...batches,batch], batchTotals:totals }
      }, profile, action, {
        module:'warehouse', previousStatus:ticket.currentStatus, newStatus:STATUSES.READY_FOR_PDI,
        details:noStock ? `Warehouse reported no more stock for batch request #${batchNumber}.` : `Warehouse allocated batch #${batchNumber} and resent ticket to PDI. Quantity: ${quantity}.`,
        metadata:{batchNumber,quantityProvided:noStock?0:Number(quantity),noStockAvailable:noStock,remarks,batch}
      })
      onDone?.()
    } finally { setSaving(false) }
  }

  return <form className="batch-request" onSubmit={submit}>
    <div className="batch-request-head"><div><div className="eyebrow">WAREHOUSE RESPONSE</div><h3>{noStock?'No Stock Available':'New Batch Allocation'}</h3><p className="muted">Allocate the next batch. The complete assignment/reassignment history stays attached to the same ticket.</p></div><span className={noStock?'badge':'badge outbound'}>{noStock?'STOCK EXHAUSTED':`BATCH #${batchNumber}`}</span></div>
    <Context ticket={ticket} batchNumber={batchNumber}/>
    <div className="card" style={{marginTop:16}}><div className="card-head"><div><h3>Batch History</h3><p className="muted">Previous batches and PDI results for this ticket.</p></div></div><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Allocated</th><th>Checked</th><th>OK</th><th>Defective</th><th>Status</th><th>Updated</th></tr></thead><tbody>{batches.length?batches.map(b=><tr key={b.batchNumber}><td>#{b.batchNumber}</td><td>{b.allocatedQty||0}</td><td>{b.checkedQty||0}</td><td>{b.approvedQty||0}</td><td>{b.defectiveQty||0}</td><td>{b.status||'—'}</td><td>{fmt(b.completedAt||b.allocatedAt)}</td></tr>):<tr><td colSpan="7" className="muted">No replacement batches yet.</td></tr>}</tbody></table></div><div className="metric-list"><div className="metric-row"><span>Total allocated across batches</span><strong>{totals.allocated}</strong></div><div className="metric-row"><span>Total OK</span><strong>{totals.approved}</strong></div><div className="metric-row"><span>Total defective</span><strong>{totals.defective}</strong></div></div></div>
    {!noStock && <div className="batch-alert"><div><strong>Requested quantity: {ticket.pdi?.requestedQuantity || ticket.qty || 0}</strong><span>Allocate only the quantity actually available in the next batch.</span></div></div>}
    {!noStock && <div className="batch-fields"><label>New Batch Quantity<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label><label>Warehouse Remarks<textarea rows="4" value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Batch details, stock position, allocation remarks…"/></label></div>}
    {noStock && <label className="batch-fields-single">Warehouse Remarks<textarea rows="4" value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Explain why no more stock is available for this item…" required/></label>}
    <label className={noStock?'batch-choice danger':'batch-choice'}><input type="checkbox" checked={noStock} onChange={e=>setNoStock(e.target.checked)}/><span><strong>No more stock available for this item</strong><small>Send the no-stock update to PDI. PDI will then complete the ticket using the no-stock PDI result.</small></span></label>
    <div className="batch-actions"><button className="primary" disabled={saving}>{saving?'Saving…':noStock?'Send No-Stock Update to PDI':'Provide Batch & Resend to PDI'}</button></div>
  </form>
}
