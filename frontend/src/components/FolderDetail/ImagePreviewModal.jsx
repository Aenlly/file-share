import { Modal, Button, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import api from '../../utils/api'

const ImagePreviewModal = ({ visible, image, folderId, onClose }) => {
  const handleDownloadOriginal = async () => {
    try {
      // 使用文件ID下载，更可靠
      const downloadUrl = `/folders/${folderId}/download/by-id/${image.id}`
      
      const response = await api.get(downloadUrl, {
        responseType: 'blob'
      })
      
      const blob = response.data
      const displayName = image.name
      
      // 尝试使用现代文件保存API
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: displayName,
            types: [{
              description: 'Images',
              accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'] }
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
          // 如果用户拒绝或出错，继续使用传统方法
        }
      }
      
      // 传统下载方法
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = displayName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // 延迟释放URL
      setTimeout(() => window.URL.revokeObjectURL(url), 100)
      message.success('下载成功')
      
    } catch (error) {
      console.error('下载失败:', error)
      if (error.response?.status === 404) {
        message.error('文件不存在')
      } else if (error.response?.status === 403) {
        message.error('无权下载此文件')
      } else {
        message.error('下载失败，请重试')
      }
    }
  }

  const handleClose = () => {
    if (image.blobUrl) {
      URL.revokeObjectURL(image.blobUrl)
    }
    onClose()
  }

  return (
    <Modal
      title={image.name}
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadOriginal}>
          下载原图
        </Button>,
        <Button key="close" onClick={handleClose}>
          关闭
        </Button>
      ]}
      width="80%"
      style={{ top: 20 }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        maxHeight: '70vh',
        overflow: 'hidden'
      }}>
        {image.loading ? (
          <div>加载中...</div>
        ) : (
          <img 
            src={image.blobUrl || image.src} 
            alt={image.name}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        )}
      </div>
    </Modal>
  )
}

export default ImagePreviewModal
