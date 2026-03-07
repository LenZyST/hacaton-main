import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAdmin } from '../../context/AdminContext'

export default function AdminUsers() {
  const { isSuperAdmin } = useAuth()
  const { users } = useAdmin()
  const navigate = useNavigate()
  useEffect(() => {
    if (!isSuperAdmin) navigate('/admin/tasks', { replace: true })
  }, [isSuperAdmin, navigate])
  if (!isSuperAdmin) return null

  return (
    <section className="admin-section card">
      <h2 className="admin-page-title">Список пользователей</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Логин</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Роль</th>
              <th>Дата регистрации</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.user_id}</td>
                <td>{u.login}</td>
                <td>{u.email}</td>
                <td>{u.phone}</td>
                <td>{u.role || '—'}</td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
