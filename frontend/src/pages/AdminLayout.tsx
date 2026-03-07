import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AdminProvider, useAdmin } from '../context/AdminContext'
import './Admin.css'

function AdminSidebar() {
  const { isSuperAdmin } = useAuth()
  return (
    <nav className="admin-sidebar">
      <ul className="admin-sidebar-list">
        <li><NavLink to="/admin/tasks" className={({ isActive }) => isActive ? 'admin-sidebar-link active' : 'admin-sidebar-link'}>Мои задачи</NavLink></li>
        <li><NavLink to="/admin/heatmap" className={({ isActive }) => isActive ? 'admin-sidebar-link active' : 'admin-sidebar-link'}>Тепловая карта</NavLink></li>
        <li><NavLink to="/admin/analytics" className={({ isActive }) => isActive ? 'admin-sidebar-link active' : 'admin-sidebar-link'}>Аналитика</NavLink></li>
        <li><NavLink to="/admin/crm" className={({ isActive }) => isActive ? 'admin-sidebar-link active' : 'admin-sidebar-link'}>CRM — все обращения</NavLink></li>
        <li><NavLink to="/admin/create-user" className={({ isActive }) => isActive ? 'admin-sidebar-link active' : 'admin-sidebar-link'}>Создать пользователя</NavLink></li>
        {isSuperAdmin && (
          <>
            <li><NavLink to="/admin/users" className={({ isActive }) => isActive ? 'admin-sidebar-link active' : 'admin-sidebar-link'}>Пользователи</NavLink></li>
            <li><NavLink to="/admin/assignments" className={({ isActive }) => isActive ? 'admin-sidebar-link active' : 'admin-sidebar-link'}>Назначение категорий</NavLink></li>
          </>
        )}
      </ul>
    </nav>
  )
}

const STATUSES = ['Не прочитано', 'В работе', 'Закрыто', 'Отклонено']

function AdminModal() {
  const { selectedAppeal, setSelectedAppeal, updateStatus, updatingId } = useAdmin()
  if (!selectedAppeal) return null
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value
    updateStatus(selectedAppeal.appeal_id, status).then(() => {
      setSelectedAppeal((prev) => (prev ? { ...prev, status } : null))
    })
  }
  return (
    <div className="admin-modal-overlay" onClick={() => setSelectedAppeal(null)}>
      <div className="admin-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>Обращение №{selectedAppeal.appeal_id}</h3>
          <button type="button" className="btn btn-ghost" onClick={() => setSelectedAppeal(null)}>Закрыть</button>
        </div>
        <dl className="admin-modal-body">
          <dt>Тема</dt><dd>{selectedAppeal.topic}</dd>
          <dt>Текст обращения</dt><dd className="admin-modal-text">{selectedAppeal.main_text}</dd>
          <dt>Дата</dt><dd>{selectedAppeal.appeal_date}</dd>
          <dt>Статус</dt>
          <dd>
            <select
              className="select admin-status-select"
              value={selectedAppeal.status}
              onChange={handleStatusChange}
              disabled={updatingId === selectedAppeal.appeal_id}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </dd>
          <dt>Категория</dt><dd>{selectedAppeal.category}</dd>
          <dt>Подкатегория</dt><dd>{selectedAppeal.subcategory ?? '—'}</dd>
          <dt>Маршрутизация</dt><dd>{(selectedAppeal.confidence * 100).toFixed(0)}%</dd>
          {selectedAppeal.photos && selectedAppeal.photos.length > 0 && (
            <>
              <dt>Фотографии</dt>
              <dd className="admin-modal-photos">
                {selectedAppeal.photos.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="admin-modal-photo-link">
                    <img src={url} alt="" className="admin-modal-photo" />
                  </a>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}

function AdminLayoutInner() {
  const { user, isAdmin } = useAuth()
  const { error } = useAdmin()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/cabinet')
    }
  }, [user, isAdmin, navigate])

  if (!user) return null
  if (!isAdmin) return <div className="admin-forbidden">Доступ только для администратора.</div>

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        {error && <p className="error-msg">{error}</p>}
        <AdminModal />
        <Outlet />
      </main>
    </div>
  )
}

export default function AdminLayout() {
  return (
    <AdminProvider>
      <AdminLayoutInner />
    </AdminProvider>
  )
}
