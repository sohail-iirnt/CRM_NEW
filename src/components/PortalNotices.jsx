import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase.js'
import { useAuth } from '../auth.jsx'
import './portal-notices.css'

const settingsRef = () => doc(db, 'settings', 'portalMaintenance')
export function PortalNoticeBar() {
  const [items,setItems]=useState([])
  useEffect(()=>onSnapshot(query(collection(db,'portalNotices'),orderBy('createdAt','desc')),s=>setItems(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false)),e=>console.error('Notice feed:',e)),[])
  if(!items.length)return null
  return <div className="portal-notice-bar" role="region" aria-label="Portal announcements"><span className="portal-notice-label">PORTAL UPDATES</span><div className="portal-notice-track"><div className="portal-notice-marquee">{[...items,...items].map((n,i)=><span key={n.id+'-'+i} className={'portal-notice-item '+(n.type||'info')}><b>{(n.type||'update').toUpperCase()}</b>{n.message}</span>)}</div></div></div>
}
export function MaintenanceGate({children}) {
  const {user,profile,loading}=useAuth(); const location=useLocation()
  const [settings,setSettings]=useState(null)
  useEffect(()=>onSnapshot(settingsRef(),s=>setSettings(s.exists()?s.data():{enabled:false}),()=>setSettings({enabled:false})),[])
  if(loading||settings===null)return <div className="loading-screen">Loading CRM SAIDHARA…</div>
  const admin=profile?.role==='admin'||profile?.accessRoles?.includes('admin')
  if(settings.enabled&&!admin&&location.pathname!=='/login'&&location.pathname!=='/forgot-password'){
    const until=settings.expectedAt?new Date(settings.expectedAt).toLocaleString():'To be announced'
    return <main className="maintenance-screen" style={settings.imageUrl?{backgroundImage:'linear-gradient(120deg,rgba(5,12,28,.92),rgba(12,31,55,.86)),url('+settings.imageUrl+')'}:{}}>
      <div className="maintenance-card"><div className="maintenance-symbol">⚙</div><span className="maintenance-kicker">CRM SAIDHARA · SYSTEM NOTICE</span><h1>We’ll be back shortly.</h1><p className="maintenance-lead">The portal is temporarily unavailable while we carry out scheduled maintenance.</p>{settings.message&&<div className="maintenance-details"><b>What’s happening</b><p>{settings.message}</p></div>}<div className="maintenance-return"><span>EXPECTED TO BE LIVE AGAIN</span><strong>{until}</strong></div><div className="maintenance-foot">Thank you for your patience. Please check back after the scheduled time.</div></div>
      <a className="maintenance-admin-entry" href="/login" aria-label="Administrator sign in" title="Administrator sign in">·</a>
    </main>
  }
  return children
}
export default function PortalNoticeManager(){
 const {user}=useAuth(); const [items,setItems]=useState([]);const [message,setMessage]=useState('');const [type,setType]=useState('update');const [busy,setBusy]=useState(false);const [maint,setMaint]=useState({enabled:false,message:'',expectedAt:'',imageUrl:''});const [file,setFile]=useState(null);const [saving,setSaving]=useState(false);const [feedback,setFeedback]=useState('')
 useEffect(()=>onSnapshot(query(collection(db,'portalNotices'),orderBy('createdAt','desc')),s=>setItems(s.docs.map(d=>({id:d.id,...d.data()})))),[])
 useEffect(()=>onSnapshot(settingsRef(),s=>setMaint(v=>({...v,...(s.exists()?s.data():{})}))),[])
 const addNotice=async e=>{e.preventDefault();if(!message.trim())return;setBusy(true);setFeedback('');try{await addDoc(collection(db,'portalNotices'),{message:message.trim(),type,active:true,createdAt:serverTimestamp(),createdBy:user?.uid||''});setMessage('');setFeedback('Announcement published.')}catch(e){setFeedback(e.message||'Could not publish announcement.')}finally{setBusy(false)}}
 const saveMaintenance=async e=>{e.preventDefault();setSaving(true);setFeedback('');try{let imageUrl=maint.imageUrl||'';if(file){const target=ref(storage,'portal-maintenance/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_'));await uploadBytes(target,file);imageUrl=await getDownloadURL(target)}await setDoc(settingsRef(),{enabled:!!maint.enabled,message:maint.message||'',expectedAt:maint.expectedAt||'',imageUrl,updatedAt:serverTimestamp(),updatedBy:user?.uid||''},{merge:true});setMaint(v=>({...v,imageUrl}));setFile(null);setFeedback(maint.enabled?'Maintenance mode is now enabled.':'Maintenance mode is disabled.')}catch(e){setFeedback(e.message||'Could not save maintenance settings.')}finally{setSaving(false)}}
 const toggleNotice=async n=>{try{await setDoc(doc(db,'portalNotices',n.id),{active:n.active===false,updatedAt:serverTimestamp()},{merge:true})}catch(e){setFeedback(e.message)}}
 const removeNotice=async n=>{if(!window.confirm('Delete this announcement?'))return;try{await deleteDoc(doc(db,'portalNotices',n.id))}catch(e){setFeedback(e.message)}}
 return <div className="portal-admin-grid"><section className="admin-panel portal-admin-panel"><div className="panel-title"><span>LIVE COMMUNICATION</span><h2>Scrolling Notice & News Bar</h2></div><p className="muted">Publish operational updates, important information and maintenance alerts. Active notices scroll across login and portal screens.</p><form onSubmit={addNotice} className="portal-notice-form"><label>Notice type<select value={type} onChange={e=>setType(e.target.value)}><option value="update">Update</option><option value="maintenance">Maintenance</option><option value="information">Information</option><option value="urgent">Urgent</option></select></label><label>Message<input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Enter announcement for all portal users…" maxLength={240} required/></label><button className="primary" disabled={busy}>{busy?'Publishing…':'Publish notice'}</button></form><div className="portal-notice-list">{items.map(n=><div className="portal-notice-row" key={n.id}><div><b>{(n.type||'update').toUpperCase()}</b><p>{n.message}</p><small>{n.active===false?'Hidden':'Visible on portal'}</small></div><button type="button" onClick={()=>toggleNotice(n)}>{n.active===false?'Show':'Hide'}</button><button type="button" className="danger" onClick={()=>removeNotice(n)}>Delete</button></div>)}{!items.length&&<div className="empty-state">No announcements published yet.</div>}</div></section>
 <section className="admin-panel portal-admin-panel"><div className="panel-title"><span>SYSTEM AVAILABILITY</span><h2>Maintenance Mode</h2></div><p className="muted">When enabled, all non-admin visitors and signed-in users see a full-screen maintenance page. Admin accounts can still sign in and disable the mode.</p><form onSubmit={saveMaintenance} className="portal-maint-form"><label className="portal-toggle"><input type="checkbox" checked={!!maint.enabled} onChange={e=>setMaint(v=>({...v,enabled:e.target.checked}))}/><span><b>{maint.enabled?'Maintenance mode ON':'Maintenance mode OFF'}</b><small>{maint.enabled?'Portal access is currently restricted for non-admin users.':'Portal is available to authorized users.'}</small></span></label><label>Expected date & time to be live again<input type="datetime-local" value={maint.expectedAt||''} onChange={e=>setMaint(v=>({...v,expectedAt:e.target.value}))}/></label><label>Maintenance information (optional)<textarea rows="4" value={maint.message||''} onChange={e=>setMaint(v=>({...v,message:e.target.value}))} placeholder="Describe the planned work, affected modules or service improvements…"/></label><label>Maintenance screen background image (optional)<input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>{maint.imageUrl&&<img className="maintenance-image-preview" src={maint.imageUrl} alt="Maintenance background preview"/>}<button className="primary" disabled={saving}>{saving?'Saving…':maint.enabled?'Save & Enable Maintenance':'Save & Disable Maintenance'}</button></form></section>{feedback&&<div className="notice success portal-feedback">{feedback}</div>}</div>
}
