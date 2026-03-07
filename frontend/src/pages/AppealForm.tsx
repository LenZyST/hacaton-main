import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import './AppealForm.css'

export default function AppealForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [topic, setTopic] = useState('')
  const [mainText, setMainText] = useState('')
  const [address, setAddress] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [anonymous, setAnonymous] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.set('topic', topic)
      formData.set('main_text', mainText)
      formData.set('date', date)
      if (user?.login && !anonymous) formData.set('login', user.login)
      if (address.trim()) formData.set('address', address.trim())
      photos.forEach((file) => formData.append('files', file))
      const res = await api.createAppeal(formData)
      setSuccess(res.message + (res.category ? ` Категория: ${res.category}` : ''))
      setTopic('')
      setMainText('')
      setAddress('')
      setDate(new Date().toISOString().slice(0, 10))
      setPhotos([])
      setTimeout(() => navigate(user ? '/cabinet' : '/'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="appeal-form-page">
      <div className="appeal-form-card card">
        <h2>Форма для заполнения обращения</h2>
        <p className="appeal-form-subtitle">Пункты со звездочкой обязательные.</p>
        <form onSubmit={handleSubmit}>
          <section className="form-section">
            <h3 className="label">Краткое описание проблемы. *</h3>
            <div className="form-group">
              <input
                className="input"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Тема обращения"
                required
                maxLength={255}
              />
            </div>
            <div className="form-group">
              <textarea
                className="textarea"
                value={mainText}
                onChange={(e) => setMainText(e.target.value)}
                placeholder="Подробное описание проблемы"
                required
                maxLength={50000}
              />
            </div>
            <div className="form-group">
              <label className="label">Адрес (для карты, необязательно)</label>
              <input
                className="input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Например: г. Чебоксары, ул. Пушкина, 3"
                maxLength={500}
              />
            </div>
            <div className="form-group">
              <label className="label">Фотографии (необязательно)</label>
              <div className="appeal-form-file-wrap">
                <input
                  id="appeal-photos"
                  className="appeal-form-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
                />
                <span className="appeal-form-file-label">Выбрать изображения</span>
              </div>
              {photos.length > 0 && (
                <p className="appeal-form-file-count">Кол-во выбранных файлов: {photos.length}</p>
              )}
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-header">
              <h3 className="label">Контактные данные заявителя.</h3>
              <label className="anonymous-toggle">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                />
                подать анонимно
              </label>
            </div>
            {!anonymous && (
              <p className="form-hint">Вы вошли в систему; обращение будет связано с вашим аккаунтом.</p>
            )}
            <div className="form-group">
              <label className="label">Дата обращения *</label>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </section>
          {error && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Отправка...' : 'Отправить обращение'}
          </button>
        </form>
      </div>
    </div>
  )
}
