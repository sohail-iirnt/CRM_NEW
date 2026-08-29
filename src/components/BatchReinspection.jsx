import { useState } from 'react'
import { STATUSES } from '../config.js'
import { updateTicket } from '../services.js'
import { useAuth } from '../auth.jsx'

function Context({ ticket, nextBatch }) {
  return <div className="batch-context">
    <div><small>Ticket</small><strong>{ticket.ticketId || ticket.id}</strong></div>
    <div><small>Item Code</small><strong>{ticket.itemCode || '—'}</strong></div>
    <div><small>Shed</small><strong>{ticket.shed || '—'}</strong></div>
    <div><small>Batch</small><strong>#{nextBatch}</strong></div>
  </div>
}

export function BatchReinspectionRequest({ ticket, onDone }) {
  const { profile } = useAuth()
  const [quantity, setQuantity] = useState(String(ticket?.qty || ''))
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  if (!ticket) return null
  const nextBatch = Number(ticket.pdi?.requestCount || 0) + 1

  async function request(e) {
    e.preventDefault()
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
    <div className="batch-request-head"><div><div className="eyebrow">PDI → WAREHOUSE</div><h3>Request New Material Batch</h3><p className="muted">The complete batch replacement cycle remains open until PDI is completed or Warehouse confirms that no stock remains.</p></div><span className="badge">REQUEST #{nextBatch}</span></div>
    <Context ticket={ticket} nextBatch={nextBatch}/>
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
  const batchNumber = Number(ticket.pdi?.requestCount || 1)

  async function submit(e) {
    e.preventDefault()
    if (!noStock && Number(quantity) < 1) return
    setSaving(true)
    try {
      const action = noStock ? 'warehouse_no_more_stock_available' : 'warehouse_new_batch_provided'
      await updateTicket(ticket.id, {
        currentStatus: STATUSES.READY_FOR_PDI,
        currentModule: 'pdi',
        previousStatus: ticket.currentStatus,
        warehouseBatch: { ...(ticket.warehouseBatch || {}), quantityProvided: noStock ? 0 : Number(quantity), noStockAvailable: noStock, responseRemarks: remarks, batchNumber }
      }, profile, action, {
        module: 'warehouse', previousStatus: ticket.currentStatus, newStatus: STATUSES.READY_FOR_PDI,
        details: noStock ? 'Warehouse confirmed no more stock is available for this item.' : `Warehouse provided batch #${batchNumber} and resent ticket to PDI. Quantity: ${quantity}.`,
        metadata: { quantityProvided: noStock ? 0 : Number(quantity), noStockAvailable: noStock, batchNumber, remarks }
      })
      onDone?.()
    } finally { setSaving(false) }
  }

  return <form className="batch-request" onSubmit={submit}>
    <div className="batch-request-head"><div><div className="eyebrow">WAREHOUSE RESPONSE</div><h3>{noStock ? 'No Stock Available' : 'New Batch Allocation'}</h3><p className="muted">Review the PDI request, allocate the next available material batch, and send the ticket back to PDI for reinspection.</p></div><span className={noStock ? 'badge' : 'badge outbound'}>{noStock ? 'STOCK EXHAUSTED' : `BATCH #${batchNumber}`}</span></div>
    <Context ticket={ticket} nextBatch={batchNumber}/>
    {!noStock && <div className="batch-alert"><div><strong>Requested quantity: {ticket.pdi?.requestedQuantity || ticket.qty || 0}</strong><span>PDI reported the previous batch as fully damaged. Allocate only the quantity that is actually available.</span></div></div>}
    {!noStock && <div className="batch-fields"><label>New Batch Quantity<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label><label>Warehouse Remarks<textarea rows="4" value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Batch details, stock position, allocation remarks…"/></label></div>}
    {noStock && <label className="batch-fields-single">Warehouse Remarks<textarea rows="4" value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Explain why no more stock is available for this item…" required/></label>}
    <label className={noStock ? 'batch-choice danger' : 'batch-choice'}><input type="checkbox" checked={noStock} onChange={e=>setNoStock(e.target.checked)}/><span><strong>No more stock available for this item</strong><small>Send a no-stock update to PDI instead of allocating another batch.</small></span></label>
    <div className="batch-actions"><button className="primary" disabled={saving}>{saving?'Saving…':noStock?'Send No-Stock Update to PDI':'Provide Batch & Resend to PDI'}</button></div>
  </form>
}
