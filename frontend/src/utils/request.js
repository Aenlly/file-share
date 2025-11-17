import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const request = axios.create({
    baseURL: API_BASE,
    timeout: 10000
})

// 请求拦截器：添加 token
request.interceptors.request.use(
    config => {
        const token = localStorage.getItem('authToken')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    error => Promise.reject(error)
)

// 响应拦截器：处理错误
request.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            const authStore = useAuthStore()
            authStore.logout()
            window.location.reload()
        }
        return Promise.reject(error)
    }
)

export default request