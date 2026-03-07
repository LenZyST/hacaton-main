import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, type Appeal } from '../api/client'
import './Cabinet.css'

export default function Cabinet() {
  const { user } = useAuth()
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [selected, setSelected] = useState<Appeal | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.login) return
    api.getMyAppeals(user.login)
      .then(setAppeals)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [user?.login])

  const categories = Array.from(new Set(appeals.map((a) => a.category).filter(Boolean))).sort()

  const filtered = appeals.filter((a) => {
    const matchSearch =
      !search ||
      a.topic.toLowerCase().includes(search.toLowerCase()) ||
      a.main_text.toLowerCase().includes(search.toLowerCase()) ||
      (a.category && a.category.toLowerCase().includes(search.toLowerCase()))
    const matchCat = !categoryFilter || a.category === categoryFilter
    return matchSearch && matchCat
  })

  if (loading) return <div className="cabinet-loading">Загрузка заявок...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <div className="cabinet">
      <h2 className="cabinet-title">Мои заявки</h2>
      <div className="cabinet-toolbar">
        <input
          type="search"
          className="input cabinet-search"
          placeholder="поиск...."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select cabinet-categories"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">сортировка категорий</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="cabinet-grid">
        <div className="cabinet-list">
          {filtered.length === 0 ? (
            <p className="cabinet-empty">Нет заявок</p>
          ) : (
            filtered.map((a) => (
              <button
                type="button"
                key={a.appeal_id}
                className={`cabinet-brief ${selected?.appeal_id === a.appeal_id ? 'active' : ''}`}
                onClick={() => setSelected(a)}
              >
                <span className="cabinet-brief-id">№{a.appeal_id}</span>
                <span className="cabinet-brief-topic">{a.topic}</span>
                <span className="cabinet-brief-meta">{a.category} · {a.status}</span>
              </button>
            ))
          )}
        </div>
        <div className="cabinet-detail card">
          {selected ? (
            <>
              <h3>Полная информация</h3>
              <dl className="cabinet-detail-list">
                <dt>Номер</dt><dd>{selected.appeal_id}</dd>
                <dt>Тема</dt><dd>{selected.topic}</dd>
                <dt>Описание</dt><dd>{selected.main_text}</dd>
                <dt>Дата</dt><dd>{selected.appeal_date}</dd>
                <dt>Статус</dt><dd>{selected.status}</dd>
                <dt>Категория</dt><dd>{selected.category}</dd>
                {selected.photos && selected.photos.length > 0 && (
                  <>
                    <dt>Фотографии</dt>
                    <dd className="cabinet-detail-photos">
                      {selected.photos.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="cabinet-detail-photo-link">
                          <img src={url} alt="" className="cabinet-detail-photo" />
                        </a>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
            </>
          ) : (
            <p className="cabinet-detail-placeholder">полная информация (место подачи, фото, видео, время подачи и т.д.)</p>
          )}
        </div>
      </div>
    </div>
  )
}
