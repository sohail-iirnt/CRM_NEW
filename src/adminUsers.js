import { addDoc, collection, doc, getApps, initializeApp, onSnapshot, serverTimestamp, setDoc, updateDoc, query, orderBy } from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { db, firebaseConfig } from './firebase.js'
import { ROLES } from './config.js'

export const USERS_COLLECTION = 'users'
export const TEAM_OPTIONS = [ROLES.CRM, ROLES.WAREHOUSE, ROLES.PDI, ROLES.LOGISTICS, ROLES.ADMIN]

export function subscribeUsers(callback, onError) {
  if (!db) return () => {}
  return onSnapshot(query(collection(db, USERS_COLLECTION), orderBy('name', 'asc')), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, onError)
}

export async function createManagedUser({ name, department, accessRoles, email, password, actor }) {
  if (!db) throw new Error('Firebase is not configured.')
  const cleanName = name?.trim()
  const cleanEmail = email?.trim().toLowerCase()
  const roles = Array.from(new Set([department, ...(accessRoles || [])].filter(Boolean)))
  if (!cleanName || !cleanEmail || !password || !department) throw new Error('Name, department, email and password are required.')
  if (password.length < 6) throw new Error('Password must contain at least 6 characters.')
  if (!roles.length) throw new Error('Select at least one access role.')

  const appName = `crm-saidhara-user-creator-${Date.now()}`
  const secondaryApp = initializeApp(firebaseConfig, appName)
  const secondaryAuth = getAuth(secondaryApp)
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password)
    await setDoc(doc(db, USERS_COLLECTION, credential.user.uid), {
      uid: credential.user.uid,
      name: cleanName,
      email: cleanEmail,
      department,
      role: roles.includes(ROLES.ADMIN) ? ROLES.ADMIN : department,
      accessRoles: roles,
      active: true,
      blocked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actor?.uid || '',
      createdByName: actor?.name || actor?.email || ''
    })
    await signOut(secondaryAuth)
    return credential.user.uid
  } finally {
    // The secondary Firebase app is intentionally isolated so the current admin session is untouched.
    // Firebase Auth account creation is handled by Auth; passwords are never written to Firestore.
  }
}

export async function updateManagedUser(uid, changes) {
  if (!db || !uid) throw new Error('User ID is required.')
  const next = { ...changes, updatedAt: serverTimestamp() }
  if (next.accessRoles) {
    next.accessRoles = Array.from(new Set(next.accessRoles.filter(Boolean)))
    if (next.accessRoles.includes(ROLES.ADMIN)) next.role = ROLES.ADMIN
    else if (!next.accessRoles.includes(next.role)) next.role = next.accessRoles[0] || ROLES.CRM
  }
  await updateDoc(doc(db, USERS_COLLECTION, uid), next)
}
