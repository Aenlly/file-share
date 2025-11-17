import axios from 'axios'

// 创建 axios 实例
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:3000/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
})

// 请求拦截器：添加 JWT Token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// 响应拦截器：统一处理错误
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // 自动登出并跳转登录页
            localStorage.removeItem('authToken')
            localStorage.removeItem('currentUser')
            window.location.href = '/login'
        } else if (error.response?.status === 403) {
            alert('无权限操作')
        } else {
            console.error('API Error:', error.message)
        }
        return Promise.reject(error)
    }
)

/**
 * ================================
 * 🔐 认证相关
 * ================================
 */
export const login = (username, password) =>
    apiClient.post('/login', { username, password })

/**
 * ================================
 * 👥 用户管理（仅 admin）
 * ================================
 */
export const getUsers = () => apiClient.get('/users')

export const addUser = (data) => apiClient.post('/users', data)

export const deleteUser = (id) => apiClient.delete(`/users/${id}`)

/**
 * ================================
 * 📁 文件夹管理
 * ================================
 */
// 获取当前用户的所有文件夹
export const getFolders = () => apiClient.get('/folders')

// 新建文件夹
export const createFolder = (data) => apiClient.post('/folders', data)

// 删除文件夹（含物理删除）
export const removeFolder = (id) => apiClient.delete(`/folders/${id}`)

/**
 * ================================
 * 📂 文件操作
 * ================================
 */
// 上传文件到指定文件夹（支持单个或多个文件）
export const uploadFile = async (folderId, formData) => {
    // formData 应该已经包含了文件和可能的强制上传选项
    // 注意：前端调用时应该传入 FormData 对象，而不是文件对象
    
    return await apiClient.post(`/folders/${folderId}/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })
}

// 初始化分片上传
export const initChunkUpload = (folderId, fileName, fileSize) =>
    apiClient.post(`/folders/${folderId}/chunk/init`, { fileName, fileSize })

// 上传文件块
export const uploadChunk = (folderId, uploadId, chunkIndex, chunk) =>
    apiClient.post(`/folders/${folderId}/chunk`, { uploadId, chunkIndex, chunk })

// 完成分片上传
export const completeChunkUpload = (folderId, uploadId) =>
    apiClient.post(`/folders/${folderId}/chunk/complete`, { uploadId })

// 获取文件夹内所有文件列表
export const getFiles = (folderId) =>
    apiClient.get(`/folders/${folderId}/files`)

// 删除某个文件（支持单个或批量删除）
export const deleteFile = (folderId, filenames) => {
    // 支持单个文件名或文件名数组
    const data = Array.isArray(filenames) ? { filenames } : { filename: filenames };
    return apiClient.delete(`/folders/${folderId}/file`, {
        data // 注意：DELETE 的 body 需要这样传
    });
}

/**
 * ================================
 * 🔗 分享功能
 * ================================
 */
// 生成分享链接（返回 access code）
export const generateShare = (data) =>
    apiClient.post('/shares', data)

// 获取用户的所有分享链接
export const getUserShares = () =>
    apiClient.get('/shares')

// 更新分享链接（延长有效期）
export const updateShare = (id, data) =>
    apiClient.put(`/shares/${id}`, data)

// 删除分享链接（使其失效）
export const deleteShare = (id) =>
    apiClient.delete(`/shares/${id}`)

// 验证访问码（访客使用）
export const verifyShareCode = (code) =>
    apiClient.get(`/share/${code}`)

// 获取打包下载流（直接跳转或 window.open）
export const downloadSharedZip = (code) =>
    `${apiClient.defaults.baseURL}/share/${code}/download`

/**
 * ================================
 * 🛠️ 工具函数
 * ================================
 */
// 格式化文件大小
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 导出apiClient实例
export default apiClient