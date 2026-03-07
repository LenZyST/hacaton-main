import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useAdmin, STATUSES } from '../../context/AdminContext'

const COLORS = ['#1e3a5f', '#2d4a73', '#3d5a80', '#4d6a8c']

const STATUS_COLORS: Record<string, string> = {
  'Отклонено': '#c0392b',
  'Не прочитано': '#e67e22',
  'В работе': '#f1c40f',
  'Закрыто': '#27ae60',
}

export default function AdminAnalytics() {
  const { appeals } = useAdmin()

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

  const getStatusColor = (name: string) => STATUS_COLORS[name] ?? COLORS[byStatus.findIndex((d) => d.name === name) % COLORS.length]

  return (
    <section className="admin-section card">
      <h2 className="admin-page-title">Аналитика</h2>
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
                {byStatus.map((d) => (
                  <Cell key={d.name} fill={getStatusColor(d.name)} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
