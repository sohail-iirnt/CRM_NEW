import { TICKET_TYPES, STATUSES, STATUS_LABELS, DESTINATION_COMPANIES, INBOUND_SOURCES, SHEDS } from './config.js'

export const CSV_HEADERS = ['ticketId','ticketType','customerName','source','destinationCompany','destinationBranch','freightOrderNo','loadNumber','vehicleNumber','shed','itemCode','itemDescription','qty','prdDate','warehouseOrderNumber','position','currentStatus','currentStatusLabel','etaDate','actualBranchReportingDate']
export const CSV_TEMPLATE_ROWS = [
  { ticketId:'CRM-0001', ticketType:'inbound', customerName:'Example Customer', source:'Haridwar', destinationCompany:'5000', destinationBranch:'Mumbai', freightOrderNo:'FO-001', loadNumber:'LOAD-001', vehicleNumber:'MH01AB0000', shed:'S', itemCode:'ITEM-001', itemDescription:'Example material', qty:'100', prdDate:'2026-08-30', warehouseOrderNumber:'', position:'', currentStatus:'', currentStatusLabel:'', etaDate:'', actualBranchReportingDate:'' },
  { ticketId:'CRM-0002', ticketType:'outbound', customerName:'Example Customer', source:'', destinationCompany:'', destinationBranch:'Pune', freightOrderNo:'FO-002', loadNumber:'LOAD-002', vehicleNumber:'MH02CD0000', shed:'P', itemCode:'ITEM-002', itemDescription:'Example outbound material', qty:'50', prdDate:'2026-08-30', warehouseOrderNumber:'WO-002', position:'P-12', currentStatus:'', currentStatusLabel:'', etaDate:'', actualBranchReportingDate:'' }
]

const escapeCsv = value => `"${String(value ?? '').replaceAll('"','""')}"`
const operationalValue = (ticket, header) => {
  if (header === 'currentStatus') return ticket.currentStatus ?? ''
  if (header === 'currentStatusLabel') return STATUS_LABELS[ticket.currentStatus] ?? ticket.currentStatus ?? ''
  if (header === 'etaDate') return ticket.logistics?.etaDate ?? ticket.etaDate ?? ''
  if (header === 'actualBranchReportingDate') return ticket.logistics?.actualBranchReportingDate ?? ticket.actualBranchReportingDate ?? ''
  return ticket[header] ?? ''
}
export function ticketsToCsv(tickets) {
  return [CSV_HEADERS, ...tickets.map(ticket => CSV_HEADERS.map(header => operationalValue(ticket, header)))].map(row => row.map(escapeCsv).join(',')).join('\r\n')
}
export function templateToCsv() { return [CSV_HEADERS, ...CSV_TEMPLATE_ROWS.map(row => CSV_HEADERS.map(header => row[header] ?? ''))].map(row => row.map(escapeCsv).join(',')).join('\r\n') }
export function downloadText(filename, text, type='text/csv;charset=utf-8') {
  const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href=url; anchor.download=filename; anchor.click(); URL.revokeObjectURL(url)
}
export function normalizeCsvLine(line) {
  const cells=[]; let current=''; let quoted=false
  for(let i=0;i<line.length;i++){const char=line[i]; if(char==='"' && line[i+1]==='"' && quoted){current+='"';i++;continue} if(char==='"'){quoted=!quoted;continue} if(char===',' && !quoted){cells.push(current.trim());current='';continue} current+=char} cells.push(current.trim()); return cells
}
export function parseCsv(text) {
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim()); if(lines.length<2) return []
  const headers=normalizeCsvLine(lines[0]).map(value=>value.trim()); return lines.slice(1).map(line=>Object.fromEntries(normalizeCsvLine(line).map((value,index)=>[headers[index],value]))).filter(row=>row.ticketId || row.customerName)
}

export function printTicketsPdf(tickets) {
  const popup=window.open('', '_blank', 'width=1400,height=900'); if(!popup) throw new Error('Please allow pop-ups to export PDF.')
  const rows=tickets.map(ticket=>`<tr><td>${safe(ticket.ticketId||ticket.id)}</td><td>${safe(ticket.ticketType)}</td><td>${safe(ticket.customerName)}</td><td>${safe(ticket.itemCode)}</td><td>${safe(ticket.shed)}</td><td>${safe(ticket.destinationBranch||ticket.destinationCompany)}</td><td>${safe(ticket.qty)}</td><td>${safe(STATUS_LABELS[ticket.currentStatus]||ticket.currentStatus)}</td><td>${safe(ticket.logistics?.etaDate||ticket.etaDate)}</td><td>${safe(ticket.logistics?.actualBranchReportingDate||ticket.actualBranchReportingDate)}</td></tr>`).join('')
  popup.document.write(`<!doctype html><html><head><title>CRM SAIDHARA Ticket Export</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#172033}h1{font-size:22px;margin:0 0 4px}p{font-size:11px;color:#667085;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:8px}th,td{border:1px solid #d9dee8;padding:5px;text-align:left}th{background:#eef2f7;font-size:7px;text-transform:uppercase}</style></head><body><h1>CRM SAIDHARA — Ticket Export</h1><p>Generated ${safe(new Date().toLocaleString())} · ${tickets.length} tickets</p><table><thead><tr><th>Ticket ID</th><th>Type</th><th>Customer</th><th>Item Code</th><th>Shed</th><th>Destination</th><th>Qty</th><th>Current Status</th><th>ETA</th><th>Actual Branch Reporting</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`); popup.document.close()
}
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))

export function validateTicketRow(row,index) {
  const errors=[]
  if(!row.ticketId) errors.push('Ticket ID is required')
  if(![TICKET_TYPES.INBOUND,TICKET_TYPES.OUTBOUND].includes(row.ticketType)) errors.push('ticketType must be inbound or outbound')
  if(!row.customerName) errors.push('Customer Name is required')
  if(!row.destinationBranch) errors.push('Destination Branch is required')
  if(!row.qty || Number(row.qty)<0) errors.push('Qty must be a positive number')
  if(row.ticketType===TICKET_TYPES.INBOUND && !row.source) errors.push('Source is required for inbound')
  if(row.ticketType===TICKET_TYPES.INBOUND && !row.destinationCompany) errors.push('Destination Company is required for inbound')
  if(row.shed && !SHEDS.includes(row.shed)) errors.push(`Shed must be one of ${SHEDS.join(', ')}`)
  if(row.source && row.ticketType===TICKET_TYPES.INBOUND && row.source!=='Other' && !INBOUND_SOURCES.includes(row.source)) errors.push('Invalid inbound source')
  if(row.destinationCompany && row.ticketType===TICKET_TYPES.INBOUND && row.destinationCompany!=='Other' && !DESTINATION_COMPANIES.includes(row.destinationCompany)) errors.push('Invalid destination company')
  return errors.length ? `Row ${index+2}: ${errors.join('; ')}` : ''
}

export const isActiveTicket = ticket => ticket.currentStatus !== STATUSES.CLOSED
