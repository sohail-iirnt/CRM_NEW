import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { MODULES, ROLES } from './config.js'
import { useAuth } from './auth.jsx'
import Login from './pages/Login.jsx'
import CRM from './pages/CRM.jsx'
import { Warehouse, PDI, Logistics } from './pages/Operations.jsx'
import Admin from './pages/Admin.jsx'

const modules = [
  [
    MODULES.CRM,
    'CRM',
    'Add / Upload Tickets',
    ROLES.CRM
  ],
  [
    MODULES.WAREHOUSE,
    'Warehousing',
    'Movement & Dispatch',
    ROLES.WAREHOUSE
  ],
  [
    MODULES.PDI,
    'PDI Inspection',
    'Inspection Queue',
    ROLES.PDI
  ],
  [
    MODULES.LOGISTICS,
    'Logistics',
    'ETA & Closure',
    ROLES.LOGISTICS
  ],
  [
    MODULES.ADMIN,
    'Admin Control Center',
    'System Administration',
    ROLES.ADMIN
  ]
]

function Protected({ requiredRole, children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        Loading CRM SAIDHARA…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  /*
   * Authentication succeeded but the Firestore user profile
   * has not been loaded/created yet.
   *
   * This is intentionally different from an inactive/blocked
   * account so the Firebase setup problem is easier to diagnose.
   */
  if (!profile) {
    return (
      <div className="loading-screen">
        <div className="error-box">
          <strong>Account profile not found.</strong>
          <span>
            Your Firebase login succeeded, but no active user profile
            was found for this account. Please contact an administrator.
          </span>
        </div>
      </div>
    )
  }

  if (profile.blocked === true) {
    return (
      <div className="loading-screen">
        <div className="error-box">
          <strong>Your account is blocked.</strong>
          <span>
            Contact an administrator to restore access.
          </span>
        </div>
      </div>
    )
  }

  if (profile.active === false) {
    return (
      <div className="loading-screen">
        <div className="error-box">
          <strong>Your account is inactive.</strong>
          <span>
            Contact an administrator to activate your account.
          </span>
        </div>
      </div>
    )
  }

  /*
   * Admin is the master role and can access every module.
   * Other users can access only their assigned module.
   */
  if (
    profile.role !== ROLES.ADMIN &&
    profile.role !== requiredRole
  ) {
    return (
      <Navigate
        to={`/${profile.role || ROLES.CRM}`}
        replace
      />
    )
  }

  return children
}

function Shell() {
  const { profile, logout, hasRole } = useAuth()
  const navigate = useNavigate()

  const visibleModules = modules.filter(
    ([, , , requiredRole]) => hasRole(requiredRole)
  )

  const isAdmin = profile?.role === ROLES.ADMIN

  return (
    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">
          <span className="brand-mark">C</span>

          <div>
            <strong>CRM SAIDHARA</strong>
            <small>Operations Platform</small>
          </div>
        </div>

        <nav>

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                isActive
                  ? 'nav-item active'
                  : 'nav-item'
              }
            >
              <span>Admin Control Center</span>
              <small>System Administration</small>
            </NavLink>
          )}

          {visibleModules
            .filter(([key]) => key !== MODULES.ADMIN)
            .map(([key, label, sub]) => (
              <NavLink
                key={key}
                to={`/${key}`}
                className={({ isActive }) =>
                  isActive
                    ? 'nav-item active'
                    : 'nav-item'
                }
              >
                <span>{label}</span>
                <small>{sub}</small>
              </NavLink>
            ))}
        </nav>

        <div className="role-card">
          <small>Signed in as</small>

          <strong>
            {profile?.role?.toUpperCase()}
          </strong>

          <span>
            {profile?.name || profile?.email}
          </span>

          <button
            className="ghost"
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
          >
            Sign out
          </button>
        </div>

      </aside>

      <main className="main">

        <header className="topbar">

          <div>
            <span className="status-dot" />
            Live Operations
          </div>

          <span>
            {profile?.name || profile?.email}
          </span>

        </header>

        <Routes>

          {/* CRM */}
          <Route
            path="/crm"
            element={
              <Protected requiredRole={ROLES.CRM}>
                <CRM />
              </Protected>
            }
          />

          {/* Warehouse */}
          <Route
            path="/warehouse"
            element={
              <Protected requiredRole={ROLES.WAREHOUSE}>
                <Warehouse />
              </Protected>
            }
          />

          {/* PDI */}
          <Route
            path="/pdi"
            element={
              <Protected requiredRole={ROLES.PDI}>
                <PDI />
              </Protected>
            }
          />

          {/* Logistics */}
          <Route
            path="/logistics"
            element={
              <Protected requiredRole={ROLES.LOGISTICS}>
                <Logistics />
              </Protected>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <Protected requiredRole={ROLES.ADMIN}>
                <Admin />
              </Protected>
            }
          />

          {/* Root */}
          <Route
            path="/"
            element={
              <Navigate
                to={
                  profile?.role === ROLES.ADMIN
                    ? '/admin'
                    : `/${profile?.role || ROLES.CRM}`
                }
                replace
              />
            }
          />

          {/* Unknown authenticated route */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

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
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
      </Routes>
    )
  }

  return <Shell />
}