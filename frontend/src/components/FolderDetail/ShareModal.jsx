import { useState } from 'react'
import { Modal, Button, Input, Typography, message } from 'antd'
import dayjs from 'dayjs'
import api from '../../utils/api'

const { Text } = Typography

const ShareModal = ({ visible, folderId, onClose }) => {
  const [shareCode, setShareCode] = useState('')
  const [shareExpiration, setShareExpiration] = useState(7)
  const [isSharing, setIsSharing] = useState(false)

  const handleGenerateShare = async () => {
    setIsSharing(true)
    try {
      const expireInMs = shareExpiration * 24 * 60 * 60 * 1000
      const response = await api.post('/shares', {
        folderId: parseInt(folderId),
        expireInMs
      })
      
      setShareCode(response.data.code)
      
      const shareUrl = `${window.location.origin}/guest`
      const accessCode = response.data.code
      const shareText = `${shareUrl}?code=${accessCode}`
      
      navigator.clipboard.writeText(shareText)
        .then(() => message.success('分享链接生成成功并已复制到剪贴板'))
        .catch(() => message.success('分享链接生成成功，但复制失败'))
    } catch (error) {
      message.error('生成分享链接失败')
      console.error('生成分享链接失败:', error)
    } finally {
      setIsSharing(false)
    }
  }

  const copyShareLink = () => {
    if (!shareCode) return
    
    const shareUrl = `${window.location.origin}/guest`
    const shareText = `${shareUrl}?code=${shareCode}`
    
    navigator.clipboard.writeText(shareText)
      .then(() => message.success('分享链接已复制到剪贴板'))
      .catch(() => message.error('复制失败'))
  }

  const handleClose = () => {
    setShareCode('')
    setShareExpiration(7)
    onClose()
  }

  return (
    <Modal
      title="分享文件夹"
      open={visible}
      onCancel={handleClose}
      footer={shareCode ? [
        <Button key="copy" type="primary" onClick={copyShareLink}>
          复制链接
        </Button>,
        <Button key="close" onClick={handleClose}>
          关闭
        </Button>
      ] : [
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button 
          key="generate" 
          type="primary" 
          onClick={handleGenerateShare}
          loading={isSharing}
        >
          生成分享链接
        </Button>
      ]}
    >
      {!shareCode ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text>设置分享链接有效期:</Text>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Button.Group>
              <Button 
                type={shareExpiration === 1 ? 'primary' : 'default'}
                onClick={() => setShareExpiration(1)}
              >
                1天
              </Button>
              <Button 
                type={shareExpiration === 7 ? 'primary' : 'default'}
                onClick={() => setShareExpiration(7)}
              >
                7天
              </Button>
              <Button 
                type={shareExpiration === 30 ? 'primary' : 'default'}
                onClick={() => setShareExpiration(30)}
              >
                30天
              </Button>
            </Button.Group>
          </div>
          <div>
            <Text type="secondary">
              分享链接将在 {dayjs().add(shareExpiration, 'day').format('YYYY-MM-DD HH:mm:ss')} 过期
            </Text>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>分享链接已生成!</Text>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text>访问码:</Text>
            <Input 
              value={shareCode} 
              readOnly 
              style={{ marginTop: 8, fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <Text type="secondary">
              链接有效期至: {dayjs().add(shareExpiration, 'day').format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ShareModal
