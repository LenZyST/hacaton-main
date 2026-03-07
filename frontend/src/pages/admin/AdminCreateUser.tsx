import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/client'

export default function AdminCreateUser() {
  const { user, isSuperAdmin } = useAuth()
  const [adminPassword, setAdminPassword] = useState('')
  const [newLogin, setNewLogin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user' | 'superadmin'>('admin')
  const [createUserMsg, setCreateUserMsg] = useState('')
  const [createUserErr, setCreateUserErr] = useState('')

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

  return (
    <section className="admin-section card">
      <h2 className="admin-page-title">Создать администратора / пользователя</h2>
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
  )
}
