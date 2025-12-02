import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 从localStorage获取token
    const authData = localStorage.getItem('auth-storage')
    if (authData) {
      try {
        const { state } = JSON.parse(authData)
        if (state.token) {
          config.headers.Authorization = `Bearer ${state.token}`
        }
      } catch (error) {
        console.error('解析认证数据失败', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // 只有在401（未授权/令牌过期）时才重定向到登录页
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      // 清除本地存储的认证信息
      localStorage.removeItem('auth-storage')
      // 重定向到登录页
      window.location.href = '/login'
    }
    // 403（禁止访问）错误不重定向，让应用处理
    return Promise.reject(error)
  }
)

export default api