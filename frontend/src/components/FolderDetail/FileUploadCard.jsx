import { useState } from 'react'
import { Card, Button, Upload, Switch, Progress, message } from 'antd'
import { UploadOutlined, InboxOutlined } from '@ant-design/icons'
import api from '../../utils/api'

const { Dragger } = Upload

const FileUploadCard = ({ folderId, onUploadSuccess, isMobile = false }) => {
  const [fileList, setFileList] = useState([])
  const [uploading, setUploading] = useState(false)
  const [forceUpload, setForceUpload] = useState(false)
  const [useChunkUpload, setUseChunkUpload] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})

  // 分片上传单个文件
  const uploadFileInChunks = async (file) => {
    const CHUNK_SIZE = 200 * 1024
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    
    try {
      let fileName = file.name
      
      if (/[^\x00-\x7F]/.test(fileName)) {
        try {
          const encoder = new TextEncoder()
          const uint8Array = encoder.encode(fileName)
          fileName = 'UTF8:' + btoa(String.fromCharCode.apply(null, uint8Array))
        } catch (e) {
          console.error('文件名编码失败:', e)
        }
      }
      
      const initResponse = await api.post(`/folders/${folderId}/chunk/init`, {
        fileName: fileName,
        fileSize: file.size
      })
      
      const { uploadId } = initResponse.data
      
      setUploadProgress(prev => ({
        ...prev,
        [file.uid]: { 
          fileName: file.name, 
          progress: 0, 
          total: totalChunks,
          status: 'uploading'
        }
      }))
      
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)
        
        const reader = new FileReader()
        const chunkBase64 = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result.split(',')[1])
          reader.readAsDataURL(chunk)
        })
        
        await api.post(`/folders/${folderId}/chunk`, {
          uploadId,
          chunkIndex,
          chunk: chunkBase64
        })
        
        setUploadProgress(prev => ({
          ...prev,
          [file.uid]: { 
            ...prev[file.uid], 
            progress: chunkIndex + 1,
            status: chunkIndex + 1 === totalChunks ? 'completed' : 'uploading'
          }
        }))
      }
      
      await api.post(`/folders/${folderId}/chunk/complete`, { uploadId })
      
      return { success: true, fileName: file.name }
    } catch (error) {
      console.error('分片上传失败:', error)
      setUploadProgress(prev => ({
        ...prev,
        [file.uid]: { 
          ...prev[file.uid], 
          status: 'error',
          error: error.message
        }
      }))
      return { success: false, fileName: file.name, error: error.message }
    }
  }

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的文件')
      return
    }

    setUploading(true)
    
    try {
      if (useChunkUpload) {
        const results = []
        
        for (const file of fileList) {
          const result = await uploadFileInChunks(file)
          results.push(result)
        }
        
        const successCount = results.filter(r => r.success).length
        const errorCount = results.length - successCount
        
        if (successCount > 0) {
          message.success(`成功上传 ${successCount} 个文件`)
        }
        
        if (errorCount > 0) {
          message.error(`${errorCount} 个文件上传失败`)
        }
        
        if (successCount > 0) {
          setFileList([])
          setUploadProgress({})
          onUploadSuccess()
        }
      } else {
        const formData = new FormData()
        
        fileList.forEach(file => {
          let fileName = file.name
          
          if (/[^\x00-\x7F]/.test(fileName)) {
            try {
              const encoder = new TextEncoder()
              const uint8Array = encoder.encode(fileName)
              const base64Name = btoa(String.fromCharCode.apply(null, uint8Array))
              fileName = 'UTF8:' + base64Name
            } catch (e) {
              console.error('文件名编码失败:', e)
            }
          }
          
          const correctedFile = new File([file], fileName, {
            type: file.type,
            lastModified: file.lastModified
          })
          formData.append('files', correctedFile)
        })
        
        if (forceUpload) {
          formData.append('force', 'true')
        }
        
        const response = await api.post(`/folders/${folderId}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        
        const { uploadedFiles, existingFiles, errorFiles } = response.data
        
        if (uploadedFiles.length > 0) {
          message.success(`成功上传 ${uploadedFiles.length} 个文件`)
        }
        
        if (existingFiles.length > 0) {
          message.warning(`${existingFiles.length} 个文件已存在`)
        }
        
        if (errorFiles.length > 0) {
          message.error(`${errorFiles.length} 个文件上传失败`)
        }
        
        if (uploadedFiles.length > 0) {
          setFileList([])
          onUploadSuccess()
        }
      }
    } catch (error) {
      console.error('上传失败:', error)
      
      // 特殊处理 409 状态码（文件已存在）
      if (error.response?.status === 409) {
        const { uploadedFiles, existingFiles, errorFiles } = error.response.data
        
        if (uploadedFiles && uploadedFiles.length > 0) {
          message.success(`成功上传 ${uploadedFiles.length} 个文件`)
        }
        
        if (existingFiles && existingFiles.length > 0) {
          message.warning(`${existingFiles.length} 个文件已存在，已跳过`)
        }
        
        if (errorFiles && errorFiles.length > 0) {
          message.error(`${errorFiles.length} 个文件上传失败`)
        }
        
        // 如果有文件上传成功，清空列表并刷新
        if (uploadedFiles && uploadedFiles.length > 0) {
          setFileList([])
          onUploadSuccess()
        } else if (existingFiles && existingFiles.length > 0) {
          // 即使只是文件已存在，也清空列表
          setFileList([])
          onUploadSuccess()
        }
      } else {
        // 其他错误
        message.error(error.response?.data?.error || '文件上传失败')
      }
    } finally {
      setUploading(false)
      setForceUpload(false)
    }
  }

  const uploadProps = {
    onRemove: (file) => {
      setFileList(fileList.filter(item => item.uid !== file.uid))
    },
    beforeUpload: (file, newFiles) => {
      setFileList(prevList => {
        const uniqueNewFiles = newFiles.filter(nf => 
          !prevList.some(f => f.name === nf.name && f.size === nf.size)
        )
        return [...prevList, ...uniqueNewFiles]
      })
      return false
    },
    fileList,
    multiple: true,
    accept: '*/*',
    showUploadList: true,
  }

  // 移动端使用普通按钮上传
  const mobileUploadProps = {
    ...uploadProps,
    showUploadList: false,
  }

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ 
        marginBottom: 16, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 12 : 0
      }}>
        <span>上传选项:</span>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 8 : 0
        }}>
          <span style={{ marginRight: isMobile ? 0 : 8, fontSize: isMobile ? 12 : 14 }}>
            使用分片上传 (适用于大文件):
          </span>
          <Switch checked={useChunkUpload} onChange={setUseChunkUpload} />
        </div>
      </div>
      
      {isMobile ? (
        // 移动端使用按钮上传
        <div style={{ textAlign: 'center', padding: '40px 20px', border: '2px dashed #d9d9d9', borderRadius: '6px', background: '#fafafa' }}>
          <p style={{ marginBottom: 16 }}>
            <InboxOutlined style={{ fontSize: 32, color: '#1890ff' }} />
          </p>
          <Upload {...mobileUploadProps}>
            <Button 
              icon={<UploadOutlined />} 
              size="large"
              type="primary"
              style={{ marginBottom: 8 }}
            >
              选择文件
            </Button>
          </Upload>
          <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            支持单个或批量文件上传 (最多200个文件)
          </p>
          {fileList.length > 0 && (
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <p style={{ fontWeight: 'bold', marginBottom: 8 }}>已选择 {fileList.length} 个文件:</p>
              {fileList.map(file => (
                <div key={file.uid} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '8px',
                  background: '#fff',
                  marginBottom: '4px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                  <Button 
                    type="text" 
                    danger 
                    size="small"
                    onClick={() => setFileList(fileList.filter(item => item.uid !== file.uid))}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // 桌面端使用拖拽上传
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16 }}>
            点击或拖拽文件到此区域上传
          </p>
          <p className="ant-upload-hint" style={{ fontSize: 14 }}>
            支持单个或批量文件上传 (最多200个文件)
          </p>
        </Dragger>
      )}
      
      {Object.keys(uploadProgress).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>上传进度:</h4>
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{progress.fileName}</span>
                <span>{progress.progress}/{progress.total}</span>
              </div>
              <Progress 
                percent={Math.round((progress.progress / progress.total) * 100)} 
                status={progress.status === 'error' ? 'exception' : progress.status === 'completed' ? 'success' : 'active'}
                size="small"
              />
            </div>
          ))}
        </div>
      )}
      
      {fileList.length > 0 && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button 
            type="primary" 
            icon={<UploadOutlined />}
            onClick={handleUpload}
            loading={uploading}
            block={isMobile}
          >
            {uploading ? '上传中...' : '开始上传'}
          </Button>
        </div>
      )}
    </Card>
  )
}

export default FileUploadCard
