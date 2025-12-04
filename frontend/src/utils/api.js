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
    // 检查响应数据中的 success 字段
    // 如果 success 为 false，说明业务逻辑失败，需要抛出错误
    if (response.data && response.data.success === false) {
      const error = new Error(response.data.error || response.data.message || '操作失败')
      error.response = {
        data: response.data,
        status: response.status,
        statusText: response.statusText
      }
      error.code = response.data.code
      return Promise.reject(error)
    }
    return response
  },
  (error) => {
    // HTTP 错误处理
    if (error.response) {
      const { status, data } = error.response
      
      // 401 未授权 - 重定向到登录页
      if (status === 401 && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
        return Promise.reject(error)
      }
      
      // 429 请求过于频繁
      if (status === 429) {
        error.message = '请求过于频繁，请稍后再试'
        error.code = 'RATE_LIMIT'
        return Promise.reject(error)
      }
      
      // 提取错误信息
      let errorMessage = data?.error || data?.message || error.message
      
      // 根据错误码提供友好提示
      if (data?.code) {
        switch (data.code) {
          case 'APF603': // 文件类型不允许
            errorMessage = data.error || '不支持的文件类型'
            break
          case 'APF903': // 存储配额超限
            errorMessage = data.error || '存储空间不足'
            break
          case 'APF901': // 请求过于频繁
            errorMessage = '请求过于频繁，请稍后再试'
            break
          case 'APF102': // 认证失败
          case 'APF103': // Token无效
          case 'APF104': // Token过期
            errorMessage = '登录已过期，请重新登录'
            break
          case 'APF202': // 权限不足
            errorMessage = '权限不足，无法执行此操作'
            break
          case 'APF301': // 资源不存在
            errorMessage = data.error || '资源不存在'
            break
          case 'APF401': // 参数缺失
          case 'APF402': // 参数无效
            errorMessage = data.error || '请求参数错误'
            break
          default:
            // 使用后端返回的错误信息
            break
        }
      }
      
      // 将错误信息附加到 error 对象
      error.message = errorMessage
    }
    
    return Promise.reject(error)
  }
)

export default api