import { useMemo } from 'react'

function escapeHtml(value) {
  return String(value ?? '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDate(value) {
  if (!value) return '—'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getToday() {
  return formatDate(new Date())
}

export default function PDIPrintSlip({ ticket, pdiDoneLog }) {
  const pdiDoneDate = useMemo(() => formatDate(pdiDoneLog?.createdAt), [pdiDoneLog])

  function printSlip() {
    const popup = window.open('', '_blank', 'width=760,height=900')
    if (!popup) return

    const ticketNumber = ticket?.ticketId || ticket?.id || '—'
    const customer = ticket?.customerName || '—'
    const destination = ticket?.destinationBranch || ticket?.destinationCompany || '—'

    popup.document.open()
    popup.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>PDI Done Slip - ${escapeHtml(ticketNumber)}</title>
<style>
  @page { size: A5 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
  .sheet { width: 100%; border: 2px solid #111827; padding: 22px; }
  .brand { text-align: center; border-bottom: 1px solid #d1d5db; padding-bottom: 14px; margin-bottom: 18px; }
  .brand h1 { margin: 0; font-size: 22px; letter-spacing: 1.4px; }
  .brand p { margin: 5px 0 0; font-size: 10px; color: #6b7280; letter-spacing: .8px; text-transform: uppercase; }
  .title { text-align: center; margin: 0 0 18px; font-size: 15px; font-weight: 700; letter-spacing: 1px; }
  .row { display: grid; grid-template-columns: 43% 57%; border-bottom: 1px solid #e5e7eb; min-height: 42px; align-items: center; }
  .row:last-child { border-bottom: 0; }
  .label { padding: 10px 8px 10px 0; font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: .5px; }
  .value { padding: 10px 0 10px 10px; font-size: 13px; font-weight: 600; word-break: break-word; }
  .ticket { font-size: 17px; letter-spacing: .5px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #d1d5db; text-align: center; font-size: 9px; color: #6b7280; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .sheet { break-inside: avoid; } }
</style>
</head>
<body>
  <main class="sheet">
    <header class="brand">
      <h1>CRM SAIDHARA</h1>
      <p>Quality Control · PDI Completion Slip</p>
    </header>
    <h2 class="title">PDI DONE SLIP</h2>
    <section>
      <div class="row"><div class="label">Date</div><div class="value">${escapeHtml(getToday())}</div></div>
      <div class="row"><div class="label">PDI Done Date</div><div class="value">${escapeHtml(pdiDoneDate)}</div></div>
      <div class="row"><div class="label">Ticket Number</div><div class="value ticket">${escapeHtml(ticketNumber)}</div></div>
      <div class="row"><div class="label">Customer Name</div><div class="value">${escapeHtml(customer)}</div></div>
      <div class="row"><div class="label">Destination Branch</div><div class="value">${escapeHtml(destination)}</div></div>
    </section>
    <div class="footer">PDI completed and recorded in CRM SAIDHARA.</div>
  </main>
  <script>window.onload = () => { window.focus(); window.print(); };</script>
</body>
</html>`)
    popup.document.close()
  }

  return (
    <button type="button" className="secondary" onClick={printSlip} title="Print PDI slip or save it as PDF">
      Print Slip / PDF
    </button>
  )
}
