import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, firebaseConfigured } from './firebase.js'
import { ROLES } from './config.js'

const AuthContext = createContext(null)
const normalizeRoles = (data) => {
  const roles = Array.isArray(data?.accessRoles) ? data.accessRoles.filter(Boolean) : []
  const primary = data?.role || roles[0] || ROLES.CRM
  return Array.from(new Set([primary, ...roles]))
}

export function AuthProvider({ children }) {
  const [user,setUser]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(firebaseConfigured),[error,setError]=useState('')
  useEffect(()=>{
    if(!auth||!db){setLoading(false);return undefined}
    return onAuthStateChanged(auth,async nextUser=>{
      setLoading(true);setError('');setUser(nextUser)
      if(!nextUser){setProfile(null);setLoading(false);return}
      try{
        const profileRef=doc(db,'users',nextUser.uid),snap=await getDoc(profileRef)
        if(!snap.exists()){
          const newProfile={uid:nextUser.uid,email:nextUser.email||'',name:nextUser.displayName||nextUser.email||'User',role:ROLES.CRM,accessRoles:[ROLES.CRM],active:true,blocked:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),lastLoginAt:serverTimestamp()}
          await setDoc(profileRef,newProfile);setProfile({...newProfile,createdAt:null,updatedAt:null,lastLoginAt:null});setLoading(false);return
        }
        const data=snap.data(),accessRoles=normalizeRoles(data),normalizedProfile={uid:nextUser.uid,email:data.email||nextUser.email||'',name:data.name||nextUser.displayName||nextUser.email||'User',role:accessRoles.includes(ROLES.ADMIN)?ROLES.ADMIN:(data.role||accessRoles[0]),accessRoles,department:data.department||data.role||accessRoles[0],active:data.active!==false,blocked:data.blocked===true}
        setProfile(normalizedProfile)
        try{await setDoc(profileRef,{lastLoginAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true})}catch(e){console.warn('Unable to update login timestamp:',e)}
      }catch(profileError){console.error('Unable to load CRM profile:',profileError);setProfile(null);setError(profileError?.message||'Unable to load your CRM account profile.')}finally{setLoading(false)}
    })
  },[])
  const login=async(email,password)=>{setError('');if(!auth){const e=new Error('Firebase is not configured. Add VITE_FIREBASE_* values to .env.local.');setError(e.message);throw e}try{await signInWithEmailAndPassword(auth,email.trim(),password)}catch(e){const code=e?.code||'';let message=e?.message||'Unable to sign in.';if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(code))message='Invalid email or password.';else if(code==='auth/too-many-requests')message='Too many unsuccessful attempts. Please try again later.';else if(code==='auth/user-disabled')message='This Firebase account has been disabled.';else if(code==='auth/invalid-email')message='Please enter a valid email address.';setError(message);throw new Error(message)}}
  const logout=async()=>{setProfile(null);setUser(null);if(auth)await signOut(auth)}
  const hasRole=role=>{if(!profile||profile.blocked===true||profile.active===false)return false;return profile.role===ROLES.ADMIN||profile.accessRoles?.includes(ROLES.ADMIN)||profile.accessRoles?.includes(role)}
  const value=useMemo(()=>({user,profile,loading,error,login,logout,hasRole,hasAccess:hasRole,firebaseConfigured}),[user,profile,loading,error])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(){return useContext(AuthContext)}
export async function touchUserProfile(userRecord,role=ROLES.CRM,additionalData={}){if(!db||!userRecord)return;await setDoc(doc(db,'users',userRecord.uid),{uid:userRecord.uid,email:userRecord.email||'',name:userRecord.displayName||userRecord.email||'',role,accessRoles:additionalData.accessRoles||[role],active:true,blocked:false,updatedAt:serverTimestamp(),...additionalData},{merge:true})}
