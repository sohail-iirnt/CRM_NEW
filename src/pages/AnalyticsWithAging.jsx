import { useState } from 'react'
import Analytics from './Analytics.jsx'
import AgingWindow from './AgingWindow.jsx'
import './analytics-aging.css'

export default function AnalyticsWithAging(){const[view,setView]=useState('overview');return <section className="analytics-workspace"><div className="analytics-workspace-tabs"><button type="button" className={view==='overview'?'active':''} onClick={()=>setView('overview')}><span>01</span><div><strong>Executive Overview</strong><small>Live operational performance</small></div></button><button type="button" className={view==='aging'?'active':''} onClick={()=>setView('aging')}><span>02</span><div><strong>Aging & SLA Intelligence</strong><small>Lifecycle, stage aging & SLA analysis</small></div></button></div>{view==='overview'?<Analytics/>:<AgingWindow/>}</section>}
