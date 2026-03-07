import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useAuth } from '../context/AuthContext'
import { api, type Appeal } from '../api/client'
import 'leaflet/dist/leaflet.css'
import './Admin.css'

const STATUSES = ['Не прочитано', 'В работе', 'Закрыто', 'Отклонено']
const COLORS = ['#1e3a5f', '#2d4a73', '#3d5a80', '#4d6a8c']

export default function Admin() {
  const { user, isAdmin, isSuperAdmin, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [createUserMsg, setCreateUserMsg] = useState('')
  const [createUserErr, setCreateUserErr] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [newLogin, setNewLogin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user' | 'superadmin'>('admin')
  const [users, setUsers] = useState<Array<{ user_id: number; login: string; email: string; phone: string; role: string; created_at: string }>>([])
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null)
  const [myTasks, setMyTasks] = useState<Appeal[]>([])
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [assignments, setAssignments] = useState<Array<{ user_id: number; login: string; categories: string[] }>>([])
  const [assignAdminId, setAssignAdminId] = useState<number | null>(null)
  const [assignCategories, setAssignCategories] = useState<string[]>([])
  const [assignPassword, setAssignPassword] = useState('')
  const [assignMsg, setAssignMsg] = useState('')
  const [assignSectionCollapsed, setAssignSectionCollapsed] = useState(true)
  const [heatMapCollapsed, setHeatMapCollapsed] = useState(true)

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  useEffect(() => {
    if (!user) return
    if (isSuperAdmin) api.getUsers().then(setUsers).catch(() => {})
    api.getAppeals()
      .then(setAppeals)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
    api.getAdminCategories().then(setAllCategories).catch(() => {})
    if (isSuperAdmin && user.login) {
      api.getAdminAssignments(user.login).then(setAssignments).catch(() => {})
    }
  }, [user, isSuperAdmin])

  useEffect(() => {
    if (!user?.login) return
    api.getMyTasks(user.login).then(setMyTasks).catch(() => {})
  }, [user?.login])

  useEffect(() => {
    if (user && !isAdmin && !loading) {
      navigate('/cabinet')
    }
  }, [user, isAdmin, loading, navigate])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateUserErr('')
    setCreateUserMsg('')
    if (!user?.login) return
    try {
      await api.createUserByAdmin({
        admin_login: user.login,
        admin_password: adminPassword,
        login: newLogin,
        password: newPassword,
        email: newEmail,
        phone: newPhone,
        role: newRole,
      })
      setCreateUserMsg('Пользователь создан.')
      setAdminPassword('')
      setNewLogin('')
      setNewPassword('')
      setNewEmail('')
      setNewPhone('')
    } catch (err: unknown) {
      setCreateUserErr(err instanceof Error ? err.message : 'Ошибка создания')
    }
  }

  const saveAssignments = async () => {
    if (!user?.login || assignAdminId == null) return
    setAssignMsg('')
    try {
      await api.setAdminAssignments({
        admin_login: user.login,
        admin_password: assignPassword,
        user_id: assignAdminId,
        categories: assignCategories,
      })
      setAssignMsg('Назначение сохранено.')
      setAssignPassword('')
      api.getAdminAssignments(user.login).then(setAssignments).catch(() => {})
      api.getMyTasks(user.login).then(setMyTasks).catch(() => {})
    } catch (e: unknown) {
      setAssignMsg(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const toggleAssignCategory = (cat: string) => {
    setAssignCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const updateStatus = async (appealId: number, status: string) => {
    setUpdatingId(appealId)
    try {
      await api.updateAppealStatus(appealId, status)
      setAppeals((prev) =>
        prev.map((a) => (a.appeal_id === appealId ? { ...a, status } : a))
      )
      setMyTasks((prev) =>
        prev.map((a) => (a.appeal_id === appealId ? { ...a, status } : a))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления')
    } finally {
      setUpdatingId(null)
    }
  }

  const byCategory = Object.entries(
    appeals.reduce<Record<string, number>>((acc, a) => {
      const c = a.category || 'Не определено'
      acc[c] = (acc[c] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([name, count]) => ({ name: name.length > 25 ? name.slice(0, 22) + '…' : name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const byStatus = STATUSES.map((s) => ({
    name: s,
    value: appeals.filter((a) => a.status === s).length,
  })).filter((d) => d.value > 0)

  if (!user) return null
  if (!isAdmin) return <div className="admin-forbidden">Доступ только для администратора.</div>

  return (
    <div className="admin">
      <h2 className="admin-title">Админ-панель</h2>
      {error && <p className="error-msg">{error}</p>}

      {selectedAppeal && (
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
              <dt>Статус</dt><dd>{selectedAppeal.status}</dd>
              <dt>Категория</dt><dd>{selectedAppeal.category}</dd>
              <dt>Подкатегория</dt><dd>{selectedAppeal.subcategory ?? '—'}</dd>
              <dt>Маршрутизация</dt><dd>{(selectedAppeal.confidence * 100).toFixed(0)}%</dd>
            </dl>
          </div>
        </div>
      )}

      <section className="admin-section card">
        <h3>Мои задачи</h3>
        <p className="admin-section-hint">Обращения по категориям, закреплённым за вами. Статус можно менять прямо в таблице.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Тема</th>
                <th>Категория</th>
                <th>Дата</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {myTasks.length === 0 ? (
                <tr><td colSpan={6}>Нет обращений по вашим категориям</td></tr>
              ) : (
                myTasks.map((a) => (
                  <tr key={a.appeal_id}>
                    <td>{a.appeal_id}</td>
                    <td className="admin-cell-topic">{a.topic}</td>
                    <td>{a.category}</td>
                    <td>{a.appeal_date}</td>
                    <td>
                      <select
                        className="select admin-status-select"
                        value={a.status}
                        onChange={(e) => updateStatus(a.appeal_id, e.target.value)}
                        disabled={updatingId === a.appeal_id}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td><button type="button" className="btn btn-ghost" onClick={() => setSelectedAppeal(a)}>Читать</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section card admin-collapsible-section">
        <button
          type="button"
          className="admin-collapsible-header"
          onClick={() => setHeatMapCollapsed((c) => !c)}
          aria-expanded={!heatMapCollapsed}
        >
          <h3>Тепловая карта по адресам</h3>
          <span className="admin-collapsible-icon">{heatMapCollapsed ? '▼' : '▲'}</span>
        </button>
        {!heatMapCollapsed && (
          <>
            <p className="admin-section-hint">
              Обращения с указанным адресом геокодируются при сохранении (Яндекс Геокодер). На карте — точки с координатами ({appeals.filter((a) => a.lat != null && a.lon != null).length} из {appeals.length}).
            </p>
            {appeals.filter((a) => a.lat != null && a.lon != null).length > 0 ? (
              <div className="admin-heatmap-wrap">
                <MapContainer
                  center={[55.75, 37.62]}
                  zoom={10}
                  style={{ height: 400, width: '100%', borderRadius: 8 }}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {appeals
                    .filter((a): a is Appeal & { lat: number; lon: number } => a.lat != null && a.lon != null)
                    .map((a) => (
                      <CircleMarker
                        key={a.appeal_id}
                        center={[a.lat, a.lon]}
                        radius={8}
                        pathOptions={{ color: '#1e3a5f', fillColor: '#2d4a73', weight: 1, fillOpacity: 0.7 }}
                      >
                        <Popup>
                          <strong>№{a.appeal_id}</strong> {a.topic}
                          <br />
                          {a.address_normalized || a.address || ''}
                        </Popup>
                      </CircleMarker>
                    ))}
                </MapContainer>
              </div>
            ) : (
              <p className="admin-section-hint">
                Нет обращений с координатами. Укажите в форме обращения поле «Адрес» и сохраните — после настройки ключа Яндекс Геокодера (YANDEX_GEOCODER_API_KEY в .env) координаты будут подставляться автоматически.
              </p>
            )}
            {appeals.filter((a) => a.address).length > 0 && (
              <>
                <p className="admin-section-hint">Обращения с указанным адресом:</p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>№</th><th>Тема</th><th>Адрес</th><th>Координаты</th></tr>
                    </thead>
                    <tbody>
                      {appeals.filter((a) => a.address).map((a) => (
                        <tr key={a.appeal_id}>
                          <td>{a.appeal_id}</td>
                          <td className="admin-cell-topic">{a.topic}</td>
                          <td>{a.address_normalized || a.address}</td>
                          <td>{a.lat != null && a.lon != null ? `${a.lat.toFixed(4)}, ${a.lon.toFixed(4)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {isSuperAdmin && (
        <section className="admin-section card admin-collapsible-section">
          <button
            type="button"
            className="admin-collapsible-header"
            onClick={() => setAssignSectionCollapsed((c) => !c)}
            aria-expanded={!assignSectionCollapsed}
          >
            <h3>Назначение категорий админам</h3>
            <span className="admin-collapsible-icon">{assignSectionCollapsed ? '▼' : '▲'}</span>
          </button>
          {!assignSectionCollapsed && (
            <>
              <p className="admin-section-hint">Выберите админа и отметьте категории, обращения по которым будут попадать в «Мои задачи» этого админа.</p>
              <div className="form-group">
                <label className="label">Администратор</label>
                <select
                  className="select"
                  value={assignAdminId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null
                    setAssignAdminId(id)
                    const a = assignments.find((x) => x.user_id === id)
                    setAssignCategories(a ? [...a.categories] : [])
                  }}
                >
                  <option value="">— выбрать —</option>
                  {assignments.map((a) => (
                    <option key={a.user_id} value={a.user_id}>{a.login}</option>
                  ))}
                </select>
              </div>
              {assignAdminId != null && (
                <>
                  <div className="admin-categories-checkboxes">
                    {allCategories.map((cat) => (
                      <label key={cat} className="admin-checkbox-label">
                        <input
                          type="checkbox"
                          checked={assignCategories.includes(cat)}
                          onChange={() => toggleAssignCategory(cat)}
                        />
                        <span>{cat.length > 60 ? cat.slice(0, 57) + '…' : cat}</span>
                      </label>
                    ))}
                  </div>
                  <div className="form-group">
                    <label className="label">Ваш пароль (для сохранения)</label>
                    <input type="password" className="input" value={assignPassword} onChange={(e) => setAssignPassword(e.target.value)} placeholder="Пароль текущего админа" />
                  </div>
                  {assignMsg && <p className={assignMsg.startsWith('Ошибка') ? 'error-msg' : 'success-msg'}>{assignMsg}</p>}
                  <button type="button" className="btn btn-primary" onClick={saveAssignments}>Сохранить назначение</button>
                </>
              )}
            </>
          )}
        </section>
      )}

      <section className="admin-section card">
        <h3>Аналитика</h3>
        <div className="admin-charts">
          <div className="admin-chart-wrap">
            <h4>Обращения по категориям</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byCategory} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                <XAxis dataKey="name" angle={-25} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="admin-chart-wrap">
            <h4>По статусам</h4>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {isSuperAdmin && (
        <section className="admin-section card">
          <h3>Список пользователей</h3>
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
      )}

      <section className="admin-section card">
        <h3>Создать администратора / пользователя</h3>
        <form onSubmit={handleCreateUser} className="admin-create-user-form">
          <div className="form-row">
            <div className="form-group">
              <label className="label">Ваш пароль (подтверждение)</label>
              <input type="password" className="input" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required placeholder="Пароль текущего админа" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Логин нового пользователя</label>
              <input type="text" className="input" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} required minLength={4} maxLength={32} />
            </div>
            <div className="form-group">
              <label className="label">Пароль</label>
              <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Email</label>
              <input type="email" className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label">Телефон</label>
              <input type="tel" className="input" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required placeholder="+79991234567" />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Роль</label>
            <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'user' | 'superadmin')}>
              <option value="user">Пользователь</option>
              <option value="admin">Администратор</option>
              {isSuperAdmin && <option value="superadmin">Суперадминистратор</option>}
            </select>
          </div>
          {createUserErr && <p className="error-msg">{createUserErr}</p>}
          {createUserMsg && <p className="success-msg">{createUserMsg}</p>}
          <button type="submit" className="btn btn-primary">Создать пользователя</button>
        </form>
      </section>

      <section className="admin-section card">
        <h3>CRM — все обращения</h3>
        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Тема</th>
                  <th>Категория</th>
                  <th>Подкатегория</th>
                  <th>Маршрутизация</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {appeals.map((a) => (
                  <tr key={a.appeal_id}>
                    <td>{a.appeal_id}</td>
                    <td className="admin-cell-topic">{a.topic}</td>
                    <td>{a.category}</td>
                    <td>{a.subcategory ?? '—'}</td>
                    <td>{(a.confidence * 100).toFixed(0)}%</td>
                    <td>{a.appeal_date}</td>
                    <td>
                      <select
                        className="select admin-status-select"
                        value={a.status}
                        onChange={(e) => updateStatus(a.appeal_id, e.target.value)}
                        disabled={updatingId === a.appeal_id}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td><button type="button" className="btn btn-ghost" onClick={() => setSelectedAppeal(a)}>Читать</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
