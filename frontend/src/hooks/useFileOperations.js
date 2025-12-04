import { useState } from 'react'
import { message } from 'antd'
import api from '../utils/api'

export const useFileOperations = (folderId) => {
  const [previewImage, setPreviewImage] = useState({ visible: false, src: '', name: '' })

  const handlePreviewImage = async (file) => {
    let savedName = file.savedName
    let displayName = file.name
    
    console.log('预览文件信息:', {
      id: file.id,
      name: file.name,
      savedName: file.savedName
    })
    
    setPreviewImage({
      visible: true,
      src: `/api/folders/${folderId}/preview/${encodeURIComponent(savedName)}?width=800&height=600`,
      name: displayName,
      id: file.id,
      savedName: savedName,
      loading: true
    })
    
    try {
      const authData = localStorage.getItem('auth-storage')
      let headers = {}
      
      if (authData) {
        try {
          const { state } = JSON.parse(authData)
          if (state.token) {
            headers.Authorization = `Bearer ${state.token}`
          }
        } catch (error) {
          console.error('解析认证数据失败', error)
        }
      }
      
      const previewUrl = `http://localhost:3000/api/folders/${folderId}/preview/${encodeURIComponent(savedName)}?width=800&height=600`
      console.log('预览URL:', previewUrl)
      
      const response = await fetch(previewUrl, { headers })
      
      if (!response.ok) {
        if (response.status === 400 || response.status === 404) {
          console.log('使用savedName失败，尝试使用原始文件名')
          const fallbackUrl = `http://localhost:3000/api/folders/${folderId}/preview/${encodeURIComponent(displayName)}?width=800&height=600`
          
          const fallbackResponse = await fetch(fallbackUrl, { headers })
          
          if (!fallbackResponse.ok) {
            const idFallbackUrl = `http://localhost:3000/api/folders/${folderId}/preview/by-id/${file.id}?width=800&height=600`
            
            try {
              const idFallbackResponse = await fetch(idFallbackUrl, { headers })
              
              if (idFallbackResponse.ok) {
                const blob = await idFallbackResponse.blob()
                const blobUrl = URL.createObjectURL(blob)
                
                setPreviewImage(prev => ({
                  ...prev,
                  blobUrl: blobUrl,
                  loading: false
                }))
                return
              }
            } catch (idError) {
              console.error('ID预览也失败:', idError)
            }
            
            throw new Error(`HTTP error! status: ${fallbackResponse.status}`)
          }
          
          const blob = await fallbackResponse.blob()
          const blobUrl = URL.createObjectURL(blob)
          
          setPreviewImage(prev => ({
            ...prev,
            blobUrl: blobUrl,
            loading: false
          }))
          return
        }
        
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      setPreviewImage(prev => ({
        ...prev,
        blobUrl: blobUrl,
        loading: false
      }))
    } catch (error) {
      console.error('获取图片预览失败:', error)
      message.error('获取图片预览失败')
      setPreviewImage({ visible: false, src: '', name: '' })
    }
  }

  const handleDownloadFile = async (file) => {
    try {
      const displayName = file.name || file.originalName
      const fileId = file.id
      
      console.log('下载文件:', { fileId, displayName, file })
      
      // 使用文件ID下载，更可靠
      const response = await api.get(`/folders/${folderId}/download/by-id/${fileId}`, {
        responseType: 'blob'
      })
      
      console.log('下载响应:', response.data.type, response.data.size)
      
      const blob = response.data
      
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: displayName,
            types: [{
              description: 'Files',
              accept: { '*/*': [] }
            }]
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          message.success('下载成功')
          return
        } catch (err) {
          if (err.name === 'AbortError') {
            message.info('已取消下载')
            return
          }
          console.log('File System Access API 失败，使用备用方案:', err)
        }
      }
      
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, displayName)
        message.success('下载成功')
        return
      }
      
      const url = window.URL.createObjectURL(blob)
      const newWindow = window.open(url, '_blank')
      
      if (newWindow) {
        setTimeout(() => {
          window.URL.revokeObjectURL(url)
        }, 1000)
        message.success('已在新窗口打开文件')
      } else {
        message.warning('请允许弹出窗口以下载文件')
        window.URL.revokeObjectURL(url)
      }
      
    } catch (error) {
      console.error('下载失败:', error)
      message.error('下载失败: ' + (error.response?.data?.error || error.message))
    }
  }

  return {
    previewImage,
    setPreviewImage,
    handlePreviewImage,
    handleDownloadFile
  }
}
