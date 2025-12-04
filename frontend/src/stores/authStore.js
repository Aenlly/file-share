import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      
      login: async (username, password) => {
        set({ isLoading: true })
        try {
          const response = await api.post('/users/login', { username, password })
          const data = response.data
          
          // 检查业务错误码（HTTP 200 但业务失败）
          if (data.success === false || data.code) {
            set({ isLoading: false })
            return { 
              success: false, 
              code: data.code,
              message: data.error || data.message || '登录失败' 
            }
          }
          
          const { token, user } = data
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false
          })
          
          // 设置API默认token
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
          return { success: true }
        } catch (error) {
          set({ isLoading: false })
          // 处理HTTP错误或网络错误
          const errorData = error.response?.data
          return { 
            success: false,
            code: errorData?.code,
            message: errorData?.error || errorData?.message || '登录失败，请检查网络连接' 
          }
        }
      },
      
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false
        })
        
        // 清除API默认token
        delete api.defaults.headers.common['Authorization']
      },
      
      initializeAuth: () => {
        const { token } = get()
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          set({ isAuthenticated: true })
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

export { useAuthStore }