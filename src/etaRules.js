import { deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase.js'
const ETA_RULES_DOCUMENT='etaRules'
const SETTINGS_COLLECTION='settings'
const normalize=value=>String(value||'').trim().toLowerCase()
export function subscribeEtaRules(callback,onError){if(!db)return()=>{};return onSnapshot(doc(db,SETTINGS_COLLECTION,ETA_RULES_DOCUMENT),snap=>{const data=snap.exists()?snap.data():{};const rules=Object.entries(data.rules||{}).map(([id,value])=>({id,...value}));callback(rules.sort((a,b)=>String(a.branch||'').localeCompare(String(b.branch||''))))},error=>{console.error('ETA rules subscription error:',error);onError?.(error)})}
const keyFor=branch=>`branch_${normalize(branch).replace(/[^a-z0-9]+/g,'_')}`
export async function saveEtaRule({id,branch,days}){if(!db)throw new Error('Firebase is not configured.');const cleanBranch=String(branch||'').trim();const numericDays=Number(days);if(!cleanBranch)throw new Error('Destination branch is required.');if(!Number.isFinite(numericDays)||numericDays<0)throw new Error('ETA days must be a valid non-negative number.');const key=id||keyFor(cleanBranch);await setDoc(doc(db,SETTINGS_COLLECTION,ETA_RULES_DOCUMENT),{rules:{[key]:{branch:cleanBranch,branchKey:normalize(cleanBranch),days:numericDays,updatedAt:new Date()}},updatedAt:new Date()},{merge:true})}
export async function removeEtaRule(id){if(!db)throw new Error('Firebase is not configured.');if(!id)return;await setDoc(doc(db,SETTINGS_COLLECTION,ETA_RULES_DOCUMENT),{[`rules.${id}`]:deleteField(),updatedAt:new Date()},{merge:true})}
export function findEtaRule(rules,destinationBranch){const key=normalize(destinationBranch);return(rules||[]).find(rule=>normalize(rule.branchKey||rule.branch)===key)||null}
