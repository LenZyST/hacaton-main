import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAdmin } from '../../context/AdminContext'
import { api } from '../../api/client'

export default function AdminAssignments() {
  const { user, isSuperAdmin } = useAuth()
  const { assignments, allCategories, refetch } = useAdmin()
  const navigate = useNavigate()
  useEffect(() => {
    if (!isSuperAdmin) navigate('/admin/tasks', { replace: true })
  }, [isSuperAdmin, navigate])
  if (!isSuperAdmin) return null
  const [assignAdminId, setAssignAdminId] = useState<number | null>(null)
  const [assignCategories, setAssignCategories] = useState<string[]>([])
  const [assignPassword, setAssignPassword] = useState('')
  const [assignMsg, setAssignMsg] = useState('')

  useEffect(() => {
    const a = assignments.find((x) => x.user_id === assignAdminId)
    setAssignCategories(a ? [...a.categories] : [])
  }, [assignAdminId, assignments])

  const toggleAssignCategory = (cat: string) => {
    setAssignCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
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
      refetch()
    } catch (e: unknown) {
      setAssignMsg(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  return (
    <section className="admin-section card">
      <h2 className="admin-page-title">Назначение категорий админам</h2>
      <p className="admin-section-hint">Выберите админа и отметьте категории, обращения по которым будут попадать в «Мои задачи» этого админа.</p>
      <div className="form-group">
        <label className="label">Администратор</label>
        <select
          className="select"
          value={assignAdminId ?? ''}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null
            setAssignAdminId(id)
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
    </section>
  )
}
