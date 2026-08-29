import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { MODULES, ROLES } from './config.js'
import { useAuth } from './auth.jsx'
import Login from './pages/Login.jsx'
import CRM from './pages/CRM.jsx'
import { Warehouse, PDI, Logistics } from './pages/Operations.jsx'
import Admin from './pages/Admin.jsx'
import Analytics from './pages/Analytics.jsx'

const modules = [
  [MODULES.CRM, 'CRM', 'Ticket Entry & Tracking', ROLES.CRM],
  [MODULES.WAREHOUSE, 'Warehousing', 'Movement & Dispatch', ROLES.WAREHOUSE],
  [MODULES.PDI, 'PDI Inspection', 'Inspection Queue', ROLES.PDI],
  [MODULES.LOGISTICS, 'Logistics', 'ETA & Closure', ROLES.LOGISTICS]
]

function Protected({ requiredRole, children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <div className="loading-screen">Loading CRM SAIDHARA…</div>
  if (!user) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <div className="loading-screen">
        <div className="error-box">
          <strong>Account profile not found.</strong>
          <span>Your Firebase login succeeded, but no active user profile was found for this account. Please contact an administrator.</span>
        </div>
      </div>
    )
  }

  if (profile.blocked === true) {
    return <div className="loading-screen"><div className="error-box"><strong>Your account is blocked.</strong><span>Contact an administrator to restore access.</span></div></div>
  }

  if (profile.active === false) {
    return <div className="loading-screen"><div className="error-box"><strong>Your account is inactive.</strong><span>Contact an administrator to activate your account.</span></div></div>
  }

  if (profile.role !== ROLES.ADMIN && profile.role !== requiredRole) {
    return <Navigate to={`/${profile.role || ROLES.CRM}`} replace />
  }

  return children
}

function Shell() {
  const { profile, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const visibleModules = modules.filter(([, , , requiredRole]) => hasRole(requiredRole))
  const isAdmin = profile?.role === ROLES.ADMIN

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">C</span>
          <div><strong>CRM SAIDHARA</strong><small>Operations Platform</small></div>
        </div>

        <nav>
          {visibleModules.map(([key, label, sub]) => (
            <div key={key} className="nav-group">
              <NavLink to={`/${key}`} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span>{label}</span><small>{sub}</small>
              </NavLink>
              <div className="nav-subpages">
                {key === MODULES.CRM && <><NavLink to="/crm" end className={({ isActive }) => isActive ? 'nav-subitem active' : 'nav-subitem'}>Ticket Entry</NavLink><NavLink to="/crm/log" className={({ isActive }) => isActive ? 'nav-subitem active' : 'nav-subitem'}>Master Ticket Log</NavLink></>}
                {key === MODULES.WAREHOUSE && <><NavLink to="/warehouse" end className={({ isActive }) => isActive ? 'nav-subitem active' : 'nav-subitem'}>Movement Queue</NavLink><NavLink to="/warehouse/dispatch" className={({ isActive }) => isActive ? 'nav-subitem active' : 'nav-subitem'}>Dispatch</NavLink></>}
                {key === MODULES.PDI && <NavLink to="/pdi" end className={({ isActive }) => isActive ? 'nav-subitem active' : 'nav-subitem'}>Inspection Queue</NavLink>}
                {key === MODULES.LOGISTICS && <><NavLink to="/logistics" end className={({ isActive }) => isActive ? 'nav-subitem active' : 'nav-subitem'}>Pending / ETA</NavLink><NavLink to="/logistics/transit" className={({ isActive }) => isActive ? 'nav-subitem active' : 'nav-subitem'}>In Transit</NavLink><NavLink to="/logistics/closed" className={({ isActive }) => isActive ? 'nav-subitem active' : 'nav-subitem'}>Closed</NavLink></>}
                <NavLink to={`/${key}/history`} className={({ isActive }) => isActive ? 'nav-subitem active' : 'nav-subitem'}>History</NavLink>
              </div>
            </div>
          ))}

          {isAdmin && (
            <>
              <div className="nav-divider" />
              <NavLink to="/analytics" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span>Analytics</span><small>Operations Intelligence</small>
              </NavLink>
              <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span>Admin Control Center</span><small>System Administration</small>
              </NavLink>
            </>
          )}
        </nav>

        <div className="role-card">
          <small>Signed in as</small>
          <strong>{profile?.role?.toUpperCase()}</strong>
          <span>{profile?.name || profile?.email}</span>
          <button className="ghost" onClick={async () => { await logout(); navigate('/login') }}>Sign out</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="status-dot" />Live Operations</div>
          <span>{profile?.name || profile?.email}</span>
        </header>

        <Routes>
          <Route path="/crm" element={<Protected requiredRole={ROLES.CRM}><CRM /></Protected>} />
          <Route path="/crm/log" element={<Protected requiredRole={ROLES.CRM}><CRM view="log" /></Protected>} />
          <Route path="/crm/history" element={<Protected requiredRole={ROLES.CRM}><CRM historyOnly /></Protected>} />

          <Route path="/warehouse" element={<Protected requiredRole={ROLES.WAREHOUSE}><Warehouse view="movement" /></Protected>} />
          <Route path="/warehouse/dispatch" element={<Protected requiredRole={ROLES.WAREHOUSE}><Warehouse view="dispatch" /></Protected>} />
          <Route path="/warehouse/history" element={<Protected requiredRole={ROLES.WAREHOUSE}><Warehouse historyOnly /></Protected>} />

          <Route path="/pdi" element={<Protected requiredRole={ROLES.PDI}><PDI /></Protected>} />
          <Route path="/pdi/history" element={<Protected requiredRole={ROLES.PDI}><PDI historyOnly /></Protected>} />

          <Route path="/logistics" element={<Protected requiredRole={ROLES.LOGISTICS}><Logistics view="pending" /></Protected>} />
          <Route path="/logistics/transit" element={<Protected requiredRole={ROLES.LOGISTICS}><Logistics view="transit" /></Protected>} />
          <Route path="/logistics/closed" element={<Protected requiredRole={ROLES.LOGISTICS}><Logistics view="closed" /></Protected>} />
          <Route path="/logistics/history" element={<Protected requiredRole={ROLES.LOGISTICS}><Logistics historyOnly /></Protected>} />

          <Route path="/analytics" element={<Protected requiredRole={ROLES.ADMIN}><Analytics /></Protected>} />
          <Route path="/admin" element={<Protected requiredRole={ROLES.ADMIN}><Admin /></Protected>} />

          <Route path="/" element={<Navigate to={profile?.role === ROLES.ADMIN ? '/admin' : `/${profile?.role || ROLES.CRM}`} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return <Shell />
}
