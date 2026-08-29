import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth'

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore'

import {
  auth,
  db,
  firebaseConfigured
} from './firebase.js'

import { ROLES } from './config.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(firebaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false)
      return undefined
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (nextUser) => {
        setLoading(true)
        setError('')
        setUser(nextUser)

        if (!nextUser) {
          setProfile(null)
          setLoading(false)
          return
        }

        try {
          const profileRef = doc(
            db,
            'users',
            nextUser.uid
          )

          const snap = await getDoc(profileRef)

          /*
           * Development-safe first-login setup.
           *
           * If the Firebase Auth account exists but the
           * Firestore user document doesn't exist, create
           * the basic CRM profile automatically.
           *
           * Admin can later change the role/access.
           */
          if (!snap.exists()) {
            const newProfile = {
              uid: nextUser.uid,
              email: nextUser.email || '',
              name:
                nextUser.displayName ||
                nextUser.email ||
                'User',
              role: ROLES.CRM,
              active: true,
              blocked: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastLoginAt: serverTimestamp()
            }

            await setDoc(
              profileRef,
              newProfile
            )

            setProfile({
              ...newProfile,
              createdAt: null,
              updatedAt: null,
              lastLoginAt: null
            })

            setLoading(false)
            return
          }

          const data = snap.data()

          const normalizedProfile = {
            uid: nextUser.uid,

            email:
              data.email ||
              nextUser.email ||
              '',

            name:
              data.name ||
              nextUser.displayName ||
              nextUser.email ||
              'User',

            role:
              data.role ||
              ROLES.CRM,

            /*
             * Missing active field is treated as active
             * for backward compatibility with existing
             * users created by the previous version.
             */
            active:
              data.active !== false,

            blocked:
              data.blocked === true
          }

          setProfile(normalizedProfile)

          try {
            await setDoc(
              profileRef,
              {
                lastLoginAt:
                  serverTimestamp(),
                updatedAt:
                  serverTimestamp()
              },
              {
                merge: true
              }
            )
          } catch (loginUpdateError) {
            console.warn(
              'Unable to update login timestamp:',
              loginUpdateError
            )
          }
        } catch (profileError) {
          console.error(
            'Unable to load/create CRM profile:',
            profileError
          )

          setProfile(null)

          setError(
            profileError?.message ||
            'Unable to load your CRM account profile.'
          )
        } finally {
          setLoading(false)
        }
      }
    )

    return unsubscribe
  }, [])

  const login = async (email, password) => {
    setError('')

    if (!auth) {
      const firebaseError = new Error(
        'Firebase is not configured. Add VITE_FIREBASE_* values to .env.local.'
      )

      setError(firebaseError.message)
      throw firebaseError
    }

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      )
    } catch (e) {
      console.error(
        'Firebase login failed:',
        e
      )

      const code = e?.code || ''

      let message =
        e?.message ||
        'Unable to sign in.'

      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        message =
          'Invalid email or password.'
      } else if (
        code === 'auth/too-many-requests'
      ) {
        message =
          'Too many unsuccessful attempts. Please try again later.'
      } else if (
        code === 'auth/user-disabled'
      ) {
        message =
          'This Firebase account has been disabled.'
      } else if (
        code === 'auth/invalid-email'
      ) {
        message =
          'Please enter a valid email address.'
      }

      setError(message)

      throw new Error(message)
    }
  }

  const logout = async () => {
    setProfile(null)
    setUser(null)

    if (!auth) {
      return
    }

    await signOut(auth)
  }

  const hasRole = (role) => {
    if (!profile) {
      return false
    }

    if (
      profile.blocked === true ||
      profile.active === false
    ) {
      return false
    }

    return (
      profile.role === ROLES.ADMIN ||
      profile.role === role
    )
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      login,
      logout,
      hasRole,
      firebaseConfigured
    }),
    [
      user,
      profile,
      loading,
      error
    ]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export async function touchUserProfile(
  userRecord,
  role = ROLES.CRM,
  additionalData = {}
) {
  if (!db || !userRecord) {
    return
  }

  const userRef = doc(
    db,
    'users',
    userRecord.uid
  )

  await setDoc(
    userRef,
    {
      uid: userRecord.uid,

      email:
        userRecord.email ||
        '',

      name:
        userRecord.displayName ||
        userRecord.email ||
        '',

      role,

      active: true,

      blocked: false,

      updatedAt:
        serverTimestamp(),

      ...additionalData
    },
    {
      merge: true
    }
  )
}