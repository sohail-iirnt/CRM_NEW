import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { MODULES, ROLES } from './config.js'

const modules = [
  [MODULES.CRM, 'CRM', 'Add / Upload Tickets', ROLES.CRM],
  [MODULES.WAREHOUSE, 'Warehousing', 'Movement & Dispatch', ROLES.WAREHOUSE],
  [MODULES.PDI, 'PDI Inspection', 'Inspection Queue', ROLES.PDI],
  [MODULES.LOGISTICS, 'Logistics', 'ETA & Closure', ROLES.LOGISTICS],
  [MODULES.ADMIN, 'Admin Control Center', 'System Administration', ROLES.ADMIN],
]

function DemoPage({ title, description }) {
  return <section className="page"><div className="eyebrow">CRM SAIDHARA 2.0</div><h1>{title}</h1><p className="muted">{description}</p><div className="notice">Module foundation is ready. Firebase authentication and the operational workflow screens will be connected in the next implementation stage.</div></section>
}

function App() {
  // Temporary role for the architecture preview. Firebase Auth + Firestore user profile
  // resolution will replace this before production access is enabled.
  const role = ROLES.ADMIN
  const canAccess = (required) => role === ROLES.ADMIN || role === required

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">C</span><div><strong>CRM SAIDHARA</strong><small>Operations Platform</small></div></div>
        <nav>
          {modules.filter(([, , , required]) => canAccess(required)).map(([key, label, sub]) => (
            <NavLink key={key} to={`/${key}`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span>{label}</span><small>{sub}</small>
            </NavLink>
          ))}
        </nav>
        <div className="role-card"><small>Current access</small><strong>ADMIN</strong><span>Full system access</span></div>
      </aside>
      <main className="main">
        <header className="topbar"><div><span className="status-dot" /> System Architecture Upgrade</div><span>Firebase-ready foundation</span></header>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/crm" element={<DemoPage title="CRM Portal" description="Inbound / Outbound ticket entry, bulk upload, and live master tracking." />} />
          <Route path="/warehouse" element={<DemoPage title="Warehousing" description="Flow-aware movement and dispatch operations." />} />
          <Route path="/pdi" element={<DemoPage title="PDI Inspection" description="Inspection queue, PDI results, evidence, and history." />} />
          <Route path="/logistics" element={<DemoPage title="Logistics" description="ETA, In Transit tracking, branch reporting, and closure." />} />
          <Route path="/admin" element={<DemoPage title="Admin Control Center" description="Users, access control, workflow rules, settings, exports, analytics, and live audit logs." />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
