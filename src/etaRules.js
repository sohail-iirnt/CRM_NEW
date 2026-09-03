import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase.js'

export const ETA_RULES_COLLECTION = 'etaRules'
const normalize = value => String(value || '').trim().toLowerCase()

export function subscribeEtaRules(callback, onError) {
  if (!db) return () => {}
  return onSnapshot(collection(db, ETA_RULES_COLLECTION), snap => {
    callback(snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.branch || '').localeCompare(String(b.branch || ''))))
  }, error => {
    console.error('ETA rules subscription error:', error)
    onError?.(error)
  })
}

export async function saveEtaRule({ id, branch, days }) {
  if (!db) throw new Error('Firebase is not configured.')
  const cleanBranch = String(branch || '').trim()
  const numericDays = Number(days)
  if (!cleanBranch) throw new Error('Destination branch is required.')
  if (!Number.isFinite(numericDays) || numericDays < 0) throw new Error('ETA days must be a valid non-negative number.')
  const key = id || `branch_${normalize(cleanBranch).replace(/[^a-z0-9]+/g, '_')}`
  await setDoc(doc(db, ETA_RULES_COLLECTION, key), {
    branch: cleanBranch,
    branchKey: normalize(cleanBranch),
    days: numericDays,
    updatedAt: new Date()
  }, { merge: true })
}

export async function removeEtaRule(id) {
  if (!db) throw new Error('Firebase is not configured.')
  if (!id) return
  await deleteDoc(doc(db, ETA_RULES_COLLECTION, id))
}

export function findEtaRule(rules, destinationBranch) {
  const key = normalize(destinationBranch)
  return (rules || []).find(rule => normalize(rule.branchKey || rule.branch) === key) || null
}
