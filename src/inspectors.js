import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from './firebase.js'

export const INSPECTORS_COLLECTION = 'inspectors'

export function subscribeInspectors(callback, onError) {
  if (!db) return () => {}
  return onSnapshot(query(collection(db, INSPECTORS_COLLECTION), orderBy('name', 'asc')), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false))
  }, onError)
}

export async function ensureInspector(name, actor) {
  if (!db || !name?.trim()) throw new Error('Inspector name is required.')
  const clean = name.trim()
  const existing = await new Promise((resolve, reject) => {
    const unsub = onSnapshot(query(collection(db, INSPECTORS_COLLECTION), where('name', '==', clean)), snap => { unsub(); resolve(snap.docs[0]) }, reject)
  })
  if (existing) return existing.id
  const ref = await addDoc(collection(db, INSPECTORS_COLLECTION), {
    name: clean,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: actor?.uid || '',
    createdByName: actor?.name || actor?.email || ''
  })
  return ref.id
}
