import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import AppealForm from './pages/AppealForm'
import Cabinet from './pages/Cabinet'
import AdminLayout from './pages/AdminLayout'
import AdminTasks from './pages/admin/AdminTasks'
import AdminHeatmap from './pages/admin/AdminHeatmap'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AdminCRM from './pages/admin/AdminCRM'
import AdminUsers from './pages/admin/AdminUsers'
import AdminAssignments from './pages/admin/AdminAssignments'
import AdminCreateUser from './pages/admin/AdminCreateUser'

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRedirect() {
  const { user, isAdmin } = useAuth()
  if (user && isAdmin) return <Navigate to="/admin" replace />
  return <Landing />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<AdminRedirect />} />
        <Route path="register" element={<Register />} />
        <Route path="login" element={<Login />} />
        <Route path="appeal" element={<AppealForm />} />
        <Route path="cabinet" element={<Protected><Cabinet /></Protected>} />
        <Route path="admin" element={<Protected><AdminLayout /></Protected>}>
          <Route index element={<Navigate to="tasks" replace />} />
          <Route path="tasks" element={<AdminTasks />} />
          <Route path="heatmap" element={<AdminHeatmap />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="crm" element={<AdminCRM />} />
          <Route path="create-user" element={<AdminCreateUser />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="assignments" element={<AdminAssignments />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
