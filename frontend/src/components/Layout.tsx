import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

export default function Layout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdminPanel = location.pathname.startsWith('/admin')

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="layout">
      <video className="layout-bg-video" autoPlay muted loop playsInline aria-hidden="true">
        <source src="/background.mp4" type="video/mp4" />
      </video>
      <div className="layout-bg-spheres" aria-hidden="true">
        <span className="layout-sphere layout-sphere--tl"><span className="layout-sphere-inner" /></span>
        <span className="layout-sphere layout-sphere--tr"><span className="layout-sphere-inner" /></span>
        <span className="layout-sphere layout-sphere--br"><span className="layout-sphere-inner" /></span>
        <span className="layout-sphere layout-sphere--bl1"><span className="layout-sphere-inner" /></span>
        <span className="layout-sphere layout-sphere--bl2"><span className="layout-sphere-inner" /></span>
        <span className="layout-sphere layout-sphere--mr"><span className="layout-sphere-inner" /></span>
      </div>
      <header className="layout-header">
        <div className="layout-header-spacer" />
        <Link to="/" className="layout-title">Городской портал</Link>
        <div className="layout-header-right">
          <nav className="layout-nav">
          {user ? (
            <>
              {isAdmin && <Link to="/admin">Админ-панель</Link>}
              <Link to="/cabinet">Мои заявки</Link>
              <Link to="/appeal">Подать обращение</Link>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>Выйти</button>
            </>
          ) : (
            <>
              <Link to="/register">Регистрация</Link>
              <Link to="/login">Войти</Link>
            </>
          )}
          </nav>
        </div>
      </header>
      <main className={isAdminPanel ? 'layout-main layout-main--wide' : 'layout-main'}>
        <Outlet />
      </main>
    </div>
  )
}
