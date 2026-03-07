import { useState, useMemo } from 'react'
import { useAdmin, STATUSES } from '../../context/AdminContext'
import { PRIORITY_TAGS } from '../../api/client'

function filterAppeals<T extends { topic: string; main_text: string; tag?: string | null }>(
  list: T[],
  search: string,
  tagFilter: string
): T[] {
  let out = list
  const q = search.trim().toLowerCase()
  if (q) out = out.filter((a) => a.topic.toLowerCase().includes(q) || a.main_text.toLowerCase().includes(q))
  if (tagFilter) out = out.filter((a) => (a.tag || '') === tagFilter)
  return out
}

export default function AdminTasks() {
  const { myTasks, updatingId, setSelectedAppeal, updateStatus } = useAdmin()
  const [searchQuery, setSearchQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const filtered = useMemo(() => filterAppeals(myTasks, searchQuery, tagFilter), [myTasks, searchQuery, tagFilter])

  return (
    <section className="admin-section card">
      <h2 className="admin-page-title">Мои задачи</h2>
      <p className="admin-section-hint">Обращения по категориям, закреплённым за вами. Статус можно менять прямо в таблице.</p>
      <div className="admin-filters">
        <input
          type="search"
          className="input admin-search"
          placeholder="Поиск по теме и тексту..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select className="select admin-tag-filter" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="">Все теги</option>
          {PRIORITY_TAGS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Тема</th>
              <th>Тег</th>
              <th>Категория</th>
              <th>Дата</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}>Нет обращений по вашим категориям</td></tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.appeal_id}>
                  <td>{a.appeal_id}</td>
                  <td className="admin-cell-topic">{a.topic}</td>
                  <td>{a.tag ?? '—'}</td>
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
  )
}
