import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { api, type Appeal } from '../api/client'

type UserRow = { user_id: number; login: string; email: string; phone: string; role: string; created_at: string }
type Assignment = { user_id: number; login: string; categories: string[] }

type AdminContextValue = {
  appeals: Appeal[]
  setAppeals: React.Dispatch<React.SetStateAction<Appeal[]>>
  myTasks: Appeal[]
  setMyTasks: React.Dispatch<React.SetStateAction<Appeal[]>>
  users: UserRow[]
  assignments: Assignment[]
  allCategories: string[]
  loading: boolean
  error: string
  setError: React.Dispatch<React.SetStateAction<string>>
  updatingId: number | null
  setUpdatingId: React.Dispatch<React.SetStateAction<number | null>>
  selectedAppeal: Appeal | null
  setSelectedAppeal: React.Dispatch<React.SetStateAction<Appeal | null>>
  updateStatus: (appealId: number, status: string) => Promise<void>
  refetch: () => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

const STATUSES = ['Не прочитано', 'В работе', 'Закрыто', 'Отклонено']

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin } = useAuth()
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [myTasks, setMyTasks] = useState<Appeal[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null)

  const refetch = useCallback(() => {
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
    if (user?.login) {
      api.getMyTasks(user.login).then(setMyTasks).catch(() => {})
    }
  }, [user, isSuperAdmin])

  useEffect(() => {
    refetch()
  }, [refetch])

  const updateStatus = useCallback(async (appealId: number, status: string) => {
    setUpdatingId(appealId)
    try {
      await api.updateAppealStatus(appealId, status)
      setAppeals((prev) => prev.map((a) => (a.appeal_id === appealId ? { ...a, status } : a)))
      setMyTasks((prev) => prev.map((a) => (a.appeal_id === appealId ? { ...a, status } : a)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления')
    } finally {
      setUpdatingId(null)
    }
  }, [])

  const value: AdminContextValue = {
    appeals,
    setAppeals,
    myTasks,
    setMyTasks,
    users,
    assignments,
    allCategories,
    loading,
    error,
    setError,
    updatingId,
    setUpdatingId,
    selectedAppeal,
    setSelectedAppeal,
    updateStatus,
    refetch,
  }

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider')
  return ctx
}

export { STATUSES }
