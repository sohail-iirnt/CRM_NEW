import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase.js'

const ETA_RULES_COLLECTION='settings'
const ETA_RULES_DOC='etaRules'
const etaRef=()=>doc(collection(db,ETA_RULES_COLLECTION),ETA_RULES_DOC)
export const subscribeEtaRules=callback=>onSnapshot(etaRef(),snap=>callback(Array.isArray(snap.data()?.rules)?snap.data().rules:[]),error=>console.error(error))
export const saveEtaRule=async rule=>{const branch=String(rule.branch||'').trim();const days=Number(rule.days);if(!branch)throw new Error('Destination branch is required.');if(!Number.isFinite(days)||days<0)throw new Error('Expected ETA days must be 0 or more.');const snapRules=await new Promise((resolve,reject)=>{const unsub=onSnapshot(etaRef(),s=>{unsub();resolve(Array.isArray(s.data()?.rules)?s.data().rules:[])},reject)});const id=rule.id||`eta_${branch.toLowerCase().replace(/[^a-z0-9]+/g,'_')}`;const next={id,branch,branchKey:branch.toLowerCase(),days};const rules=snapRules.filter(item=>item.id!==id&&String(item.branch||'').toLowerCase()!==branch.toLowerCase());await setDoc(etaRef(),{rules:[...rules,next],updatedAt:new Date()},{merge:true})}
export const removeEtaRule=async id=>{const snapRules=await new Promise((resolve,reject)=>{const unsub=onSnapshot(etaRef(),s=>{unsub();resolve(Array.isArray(s.data()?.rules)?s.data().rules:[])},reject)});await setDoc(etaRef(),{rules:snapRules.filter(rule=>rule.id!==id),updatedAt:new Date()},{merge:true})}
export const findEtaRule=(rules,branch)=>{const key=String(branch||'').trim().toLowerCase();return rules.find(rule=>String(rule.branchKey||rule.branch||'').trim().toLowerCase()===key)||null}
