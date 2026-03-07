import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import './Auth.css'

export default function Register() {
  const navigate = useNavigate()
  const { login: doLogin } = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const loginTrim = login.trim()
    if (loginTrim.length < 4 || loginTrim.length > 32) {
      setError('Логин: от 4 до 32 символов')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(loginTrim)) {
      setError('Логин: только латиница, цифры и _')
      return
    }
    if (password.length < 8) {
      setError('Пароль: минимум 8 символов')
      return
    }
    if (!/[a-z]/.test(password)) {
      setError('Пароль должен содержать строчные буквы')
      return
    }
    if (!/[A-Z]/.test(password)) {
      setError('Пароль должен содержать заглавные буквы')
      return
    }
    if (!/\d/.test(password)) {
      setError('Пароль должен содержать цифры')
      return
    }
    if (password.length > 72) {
      setError('Пароль слишком длинный')
      return
    }
    const emailTrim = email.trim()
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError('Введите корректный email')
      return
    }
    const phoneTrim = phone.trim().replace(/\s/g, '')
    if (!/^\+?\d{10,15}$/.test(phoneTrim)) {
      setError('Телефон: 10–15 цифр, можно с + в начале')
      return
    }
    setLoading(true)
    try {
      await api.register({ login: loginTrim, password, email: emailTrim, phone: phoneTrim })
      await doLogin(loginTrim, password)
      navigate('/cabinet')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка регистрации'
      const short = msg.replace(/\s*[Уу] вас сейчас \d+[^.]*\.?\s*/gi, '').replace(/\s*[Дд]лина текста сейчас:?\s*\d+\.?\s*/gi, '')
      setError(short)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h2>Регистрация</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="label">Логин *</label>
            <input
              className="input"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="4–32 символа, латиница/цифры/_"
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="label">Пароль *</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 8 символов, буквы и цифры"
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label className="label">Email *</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.ru"
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="label">Телефон *</label>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+79991234567"
              autoComplete="tel"
            />
          </div>
          {error && <p className="auth-error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className="auth-footer">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  )
}
