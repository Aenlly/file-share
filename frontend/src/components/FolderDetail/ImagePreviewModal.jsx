import { Modal, Button, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import api from '../../utils/api'

const ImagePreviewModal = ({ visible, image, folderId, onClose }) => {
  const handleDownloadOriginal = async () => {
    try {
      const downloadUrl = image.src.replace(/width=\d+&height=\d+/, 'width=1920&height=1080')
      
      const response = await api.get(downloadUrl.replace('/api', ''), {
        responseType: 'blob'
      })
      
      const blob = response.data
      const displayName = image.name
      
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: displayName,
            types: [{
              description: 'Images',
              accept: { 'image/*': [] }
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
        }
      }
      
      const url = window.URL.createObjectURL(blob)
      const newWindow = window.open(url, '_blank')
      
      if (newWindow) {
        setTimeout(() => window.URL.revokeObjectURL(url), 1000)
        message.success('已在新窗口打开图片')
      } else {
        message.warning('请允许弹出窗口以下载文件')
        window.URL.revokeObjectURL(url)
      }
      
    } catch (error) {
      console.error('下载失败:', error)
      message.error('下载失败')
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
