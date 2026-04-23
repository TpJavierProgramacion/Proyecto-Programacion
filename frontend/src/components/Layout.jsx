import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useState } from 'react'

const nav = [
  { to: '/', label: 'Dashboard', icon: '[+]' },
  { to: '/materias', label: 'Materias', icon: '[M]' },
  { to: '/calendar', label: 'Calendario', icon: '[C]' },
  { to: '/brain-drain', label: 'Brain Drain', icon: '[B]' },
  { to: '/flashcards', label: 'Flashcards', icon: '[F]' },
  { to: '/chat', label: 'UniBot AI', icon: '[A]' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="layout">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!collapsed && <span className="logo-text">UNI<em>BOT</em></span>}
          {collapsed && <span className="logo-icon">UB</span>}
          <button type="button" className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '>>' : '<<'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {nav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="user-info">
              <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
              <div className="user-details">
                <span className="user-name">{user?.username}</span>
                <span className="user-email">{user?.email}</span>
              </div>
            </div>
          )}
          <button type="button" className="theme-btn" onClick={toggle} title="toggle theme">
            {theme === 'dark' ? 'LT' : 'DK'}
          </button>
          <button type="button" className="logout-btn" onClick={async () => { await logout(); navigate('/login') }} title="logout">
            OUT
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
