import { useEffect, useRef, useState } from 'react'
import { STATUSES } from '../config.js'
import { subscribeTickets, updateTicket } from '../services.js'
import { findEtaRule } from '../etaRules.js'
import { subscribeEtaRules } from '../etaRules.js'
import { useAuth } from '../auth.jsx'

const normalizeDate = value => value || ''
const toDate = value => value?.toMillis ? new Date(value.toMillis()) : value ? new Date(value) : new Date()
const addDays = (base, days) => {
  const date = toDate(base)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + Number(days || 0))
  return date.toISOString().slice(0, 10)
}
const existingEta = ticket => normalizeDate(ticket?.logistics?.etaDate || ticket?.logistics?.expectedEtaDate || ticket?.etaDate)
const handoffDate = ticket => ticket?.dispatch?.dispatchedAt || ticket?.statusChangedAt || ticket?.updatedAt || new Date()

export default function AutoEtaHandoff() {
  const { profile } = useAuth()
  const [tickets, setTickets] = useState([])
  const [rules, setRules] = useState([])
  const processing = useRef(new Set())

  useEffect(() => subscribeTickets(setTickets), [])
  useEffect(() => subscribeEtaRules(setRules), [])

  useEffect(() => {
    const allowed = profile?.role === 'admin' || profile?.accessRoles?.includes('admin') || profile?.role === 'logistics' || profile?.accessRoles?.includes('logistics')
    if (!allowed || !tickets.length) return

    const candidates = tickets.filter(ticket => ticket.currentStatus === STATUSES.LOGISTICS_PENDING)

    candidates.forEach(async ticket => {
      if (processing.current.has(ticket.id)) return

      const rule = findEtaRule(rules, ticket.destinationBranch)
      const currentEta = existingEta(ticket)
      if (!currentEta && !rule) return

      const expectedEta = currentEta || addDays(handoffDate(ticket), rule.days)
      processing.current.add(ticket.id)

      try {
        await updateTicket(ticket.id, {
          currentStatus: STATUSES.IN_TRANSIT,
          currentModule: 'logistics',
          previousStatus: ticket.currentStatus,
          logistics: {
            ...(ticket.logistics || {}),
            etaDate: expectedEta,
            expectedEtaDate: expectedEta,
            ...(rule ? {
              etaRuleBranch: rule.branch,
              etaRuleDays: Number(rule.days),
              etaManual: false
            } : {
              etaManual: true
            }),
            ...(rule && !currentEta ? { etaCalculatedAt: new Date() } : {})
          }
        }, profile, 'logistics_auto_eta_handoff', {
          module: 'logistics',
          previousStatus: ticket.currentStatus,
          newStatus: STATUSES.IN_TRANSIT,
          details: rule && !currentEta
            ? `Admin ETA rule matched ${ticket.destinationBranch || 'destination'}; Expected ETA ${expectedEta} calculated automatically and ticket moved to In Transit.`
            : `Existing Expected ETA ${expectedEta} found; ticket moved automatically to In Transit.`,
          metadata: {
            destinationBranch: ticket.destinationBranch || '',
            expectedEta,
            automatic: Boolean(rule && !currentEta),
            manualEta: Boolean(!rule && currentEta),
            etaRuleDays: rule ? Number(rule.days) : null
          }
        })
      } catch (error) {
        console.error('Automatic ETA handoff failed:', ticket.id, error)
      } finally {
        processing.current.delete(ticket.id)
      }
    })
  }, [tickets, rules, profile])

  return null
}
