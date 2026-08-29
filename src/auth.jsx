import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, firebaseConfigured } from './firebase.js'
import { ROLES } from './config.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(firebaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth || !db) { setLoading(false); return undefined }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      if (!nextUser) { setProfile(null); setLoading(false); return }
      try {
        const snap = await getDoc(doc(db, 'users', nextUser.uid))
        if (!snap.exists()) {
          setProfile({ uid: nextUser.uid, email: nextUser.email, name: nextUser.displayName || nextUser.email, role: ROLES.CRM, active: true })
        } else setProfile({ uid: nextUser.uid, ...snap.data() })
      } finally { setLoading(false) }
    })
  }, [])

  const login = async (email, password) => {
    setError('')
    if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to .env.local.')
    try { await signInWithEmailAndPassword(auth, email, password) } catch (e) { setError(e.message); throw e }
  }
  const logout = () => auth ? signOut(auth) : Promise.resolve()
  const hasRole = (role) => profile?.role === ROLES.ADMIN || profile?.role === role
  const value = useMemo(() => ({ user, profile, loading, error, login, logout, hasRole, firebaseConfigured }), [user, profile, loading, error])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }

export async function touchUserProfile(userRecord, role = ROLES.CRM) {
  if (!db || !userRecord) return
  await setDoc(doc(db, 'users', userRecord.uid), { email: userRecord.email || '', name: userRecord.displayName || userRecord.email || '', role, active: true, updatedAt: serverTimestamp() }, { merge: true })
}
