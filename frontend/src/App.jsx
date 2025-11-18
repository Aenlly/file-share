import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import FolderDetail from './pages/FolderDetail'
import UserManagement from './pages/UserManagement'
import ShareManagement from './pages/ShareManagement'
import Profile from './pages/Profile'
import GuestAccess from './pages/GuestAccess'
import Layout from './components/Layout'

function App() {
  const { isAuthenticated, initializeAuth } = useAuthStore()
  
  // 初始化认证状态
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/guest" element={<GuestAccess />} />
        <Route path="/guest/:code" element={<GuestAccess />} />
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="folder/:id" element={<FolderDetail />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="shares" element={<ShareManagement />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </div>
  )
}

export default App