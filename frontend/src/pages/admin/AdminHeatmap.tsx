import { useEffect, useRef, useMemo, useState } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { type Appeal, PRIORITY_TAGS } from '../../api/client'

const YANDEX_API_URL = 'https://api-maps.yandex.ru/2.1'
const HEATMAP_PLUGIN_URL = 'https://yastatic.net/s3/mapsapi-jslibs/heatmap/0.0.1/heatmap.min.js'

const THERMAL_GRADIENT: Record<string, string> = {
  '0': 'rgba(255, 255, 0, 0.5)',
  '0.3': 'rgba(255, 200, 0, 0.65)',
  '0.5': 'rgba(255, 140, 0, 0.8)',
  '0.7': 'rgba(255, 80, 0, 0.9)',
  '1': 'rgba(255, 0, 0, 1)',
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) ?? document.querySelector(`script[src^="${src.split('?')[0]}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Не удалось загрузить: ${src}`))
    document.head.appendChild(script)
  })
}

export default function AdminHeatmap() {
  const { appeals, setSelectedAppeal } = useAdmin()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{
    map: { destroy: () => void; geoObjects: { add: (o: unknown) => void; remove: (o: unknown) => void } }
    heatmap: { destroy: () => void }
    placemarks: unknown[]
  } | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapLoading, setMapLoading] = useState(false)

  const ACTIVE_STATUSES = ['Не прочитано', 'В работе']
  const withCoords = useMemo(
    () =>
      appeals.filter(
        (a): a is Appeal & { lat: number; lon: number } =>
          a.lat != null && a.lon != null && ACTIVE_STATUSES.includes(a.status)
      ),
    [appeals]
  )
  const withAddress = appeals.filter((a) => a.address)
  /** В таблице под картой — только активные (как на карте) */
  const withAddressActive = withAddress.filter((a) => ACTIVE_STATUSES.includes(a.status))
  const [searchQuery, setSearchQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const withAddressFiltered = useMemo(() => {
    let out = withAddressActive
    const q = searchQuery.trim().toLowerCase()
    if (q) out = out.filter((a) => a.topic.toLowerCase().includes(q) || a.main_text.toLowerCase().includes(q))
    if (tagFilter) out = out.filter((a) => (a.tag || '') === tagFilter)
    return out
  }, [withAddressActive, searchQuery, tagFilter])

  const heatmapData = useMemo(() => withCoords.map((a) => [a.lat, a.lon] as [number, number]), [withCoords])

  const coordsGroups = useMemo(() => {
    const key = (a: Appeal & { lat: number; lon: number }) => `${a.lat.toFixed(6)},${a.lon.toFixed(6)}`
    const map = new Map<string, (Appeal & { lat: number; lon: number })[]>()
    withCoords.forEach((a) => {
      const k = key(a)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(a)
    })
    return Array.from(map.entries()).map(([k]) => {
      const [lat, lon] = k.split(',').map(Number)
      return { lat, lon, appeals: map.get(k)! }
    })
  }, [withCoords])

  useEffect(() => {
    const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim()
    if (!apiKey || !containerRef.current || heatmapData.length === 0) {
      setMapError(null)
      return
    }

    setMapError(null)
    setMapLoading(true)
    let cancelled = false
    const container = containerRef.current
    const dataSnapshot = heatmapData
    const groupsSnapshot = coordsGroups
    const apiUrl = `${YANDEX_API_URL}/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`

    loadScript(apiUrl)
      .then(() => loadScript(HEATMAP_PLUGIN_URL))
      .then(() => {
        if (cancelled) return
        const ymaps = (window as Window & { ymaps: unknown }).ymaps
        if (!ymaps || typeof (ymaps as { ready?: (f: () => void) => void }).ready !== 'function') {
          setMapError('Яндекс.Карты не загрузились. Проверьте ключ и консоль браузера (F12).')
          setMapLoading(false)
          return
        }
        ;(ymaps as { ready: (fn: () => void) => void }).ready(() => {
          if (cancelled) return
          try {
            const y = ymaps as {
              Map: new (el: HTMLElement, state: { center: number[]; zoom: number }) => { destroy: () => void; geoObjects: { add: (o: unknown) => void; remove: (o: unknown) => void } }
              Placemark: new (coords: number[], props: object, opts?: object) => unknown
              modules: { require: (names: string[], cb: (Heatmap: new (data: number[][], opts?: object) => { setMap: (m: unknown) => void; setData: (d: number[][]) => void; destroy: () => void }) => void) => void }
            }
            const map = new y.Map(container, {
              center: [55.75, 37.62],
              zoom: 10,
            })
            y.modules.require(['Heatmap'], (Heatmap: new (data: number[][], opts?: object) => { setMap: (m: unknown) => void; setData: (d: number[][]) => void; destroy: () => void }) => {
              if (cancelled) {
                map.destroy()
                return
              }
              const heatmap = new Heatmap(dataSnapshot, {
                radius: 15,
                dissipating: true,
                opacity: 0.85,
                intensityOfMidpoint: 0.3,
                gradient: THERMAL_GRADIENT,
              })
              heatmap.setMap(map)
              const placemarks: unknown[] = []
              groupsSnapshot.forEach(({ lat, lon, appeals: groupAppeals }) => {
                const count = groupAppeals.length
                const hint = count === 1
                  ? `№${groupAppeals[0].appeal_id}: ${groupAppeals[0].topic}`
                  : `${count} обращений по этому адресу`
                const header = count === 1
                  ? `Обращение №${groupAppeals[0].appeal_id}`
                  : `Обращения по адресу (${count})`
                const body = groupAppeals
                  .map(
                    (a) =>
                      `<strong>№${a.appeal_id}</strong> ${escapeHtml(a.topic)}<br/><small>${escapeHtml(a.address_normalized || a.address || '')}</small><br/><a href="#" class="admin-balloon-goto" onclick="(window.top||window).dispatchEvent(new CustomEvent('adminOpenAppeal', { detail: { appealId: ${a.appeal_id} } })); return false;">Перейти</a>`
                  )
                  .join('<br/><br/>')
                const pm = new y.Placemark(
                  [lat, lon],
                  {
                    hintContent: hint,
                    balloonContentHeader: header,
                    balloonContentBody: body,
                  },
                  { preset: 'islands#circleDotIcon', iconColor: 'rgba(128,128,128,0.4)', iconCaptionMaxWidth: 200 }
                )
                map.geoObjects.add(pm)
                placemarks.push(pm)
              })
              mapRef.current = { map, heatmap, placemarks }
              setMapError(null)
              setMapLoading(false)
            })
          } catch (e) {
            setMapError(e instanceof Error ? e.message : 'Ошибка инициализации карты')
            console.error('Yandex Heatmap init:', e)
            setMapLoading(false)
          }
        })
      })
      .catch((e) => {
        if (!cancelled) {
          setMapError(e instanceof Error ? e.message : 'Не удалось загрузить скрипты карты')
          console.error('Yandex Maps load:', e)
        }
        setMapLoading(false)
      })

    return () => {
      cancelled = true
      setMapLoading(false)
      const ref = mapRef.current
      if (ref) {
        ref.placemarks.forEach((pm) => ref.map.geoObjects.remove(pm))
        ref.heatmap.destroy()
        ref.map.destroy()
        mapRef.current = null
      }
    }
  }, [heatmapData.length, coordsGroups.length])

  useEffect(() => {
    const ref = mapRef.current
    if (!ref?.heatmap || heatmapData.length === 0) return
    const h = ref.heatmap as { setData?: (d: number[][]) => void }
    if (typeof h.setData === 'function') h.setData(heatmapData)
  }, [heatmapData])

  useEffect(() => {
    const target = typeof window !== 'undefined' ? window : null
    if (!target) return
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ appealId: number }>
      const id = ev.detail?.appealId
      if (id == null) return
      const appeal = appeals.find((a) => a.appeal_id === id)
      if (appeal) setSelectedAppeal(appeal)
    }
    target.addEventListener('adminOpenAppeal', handler)
    return () => target.removeEventListener('adminOpenAppeal', handler)
  }, [appeals, setSelectedAppeal])

  const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim()

  return (
    <section className="admin-section card">
      <h2 className="admin-page-title">Тепловая карта по адресам</h2>
      <p className="admin-section-hint">
        Обращения с указанным адресом геокодируются при сохранении (Яндекс Геокодер). На карте только обращения со статусом «Не прочитано» и «В работе». Жёлтый — мало, красный — много ({withCoords.length} точек). Наведите курсор на точку — появится подсказка с обращением, по клику — балун.
      </p>
      {!apiKey ? (
        <p className="admin-section-hint">
          Для отображения карты создайте в папке <strong>frontend</strong> файл <code>.env</code> и добавьте строку: <code>VITE_YANDEX_MAPS_API_KEY=ваш_ключ</code> (тот же ключ, что для Геокодера, подойдёт). После сохранения перезапустите <code>npm run dev</code>.
        </p>
      ) : withCoords.length > 0 ? (
        <div className="admin-heatmap-wrap">
          {mapLoading && <p className="admin-section-hint">Загрузка карты…</p>}
          {mapError && <p className="error-msg">{mapError}</p>}
          <div
            ref={containerRef}
            style={{
              height: 400,
              minHeight: 400,
              width: '100%',
              borderRadius: 8,
              background: 'var(--color-bg-subtle, #f0f0f0)',
            }}
          />
        </div>
      ) : (
        <p className="admin-section-hint">
          Нет обращений с координатами. Укажите в форме обращения поле «Адрес» и сохраните — после настройки ключа Яндекс Геокодера (YANDEX_GEOCODER_API_KEY в .env) координаты будут подставляться автоматически.
        </p>
      )}
      {withAddressActive.length > 0 && (
        <>
          <p className="admin-section-hint">Обращения с указанным адресом (только «Не прочитано» и «В работе»):</p>
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
                <tr><th>№</th><th>Тема</th><th>Тег</th><th>Адрес</th><th></th></tr>
              </thead>
              <tbody>
                {withAddressFiltered.map((a) => (
                  <tr key={a.appeal_id}>
                    <td>{a.appeal_id}</td>
                    <td className="admin-cell-topic">{a.topic}</td>
                    <td>{a.tag ?? '—'}</td>
                    <td>{a.address_normalized || a.address}</td>
                    <td><button type="button" className="btn btn-ghost" onClick={() => setSelectedAppeal(a)}>Подробнее</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
