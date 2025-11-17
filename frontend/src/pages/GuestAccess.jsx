import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { 
  Card, 
  Button, 
  List, 
  Typography, 
  message, 
  Space,
  Spin,
  Empty
} from 'antd'
import { 
  DownloadOutlined, 
  FileOutlined, 
  FolderOpenOutlined 
} from '@ant-design/icons'
import { useQuery } from 'react-query'
import dayjs from 'dayjs'
import api from '../utils/api'

const { Title, Text } = Typography

const GuestAccess = () => {
  const { code } = useParams()
  const [downloading, setDownloading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 获取分享内容
  const { data: shareData, isLoading, error } = useQuery(
    ['share', code],
    async () => {
      const response = await api.get(`/share/${code}`)
      return response.data
    },
    {
      enabled: !!code,
      retry: false
    }
  )

  const handleDownloadAll = async () => {
    setDownloading(true)
    try {
      window.open(`/api/share/${code}/download`, '_blank')
    } catch (error) {
      message.error('下载失败')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadFile = (file) => {
    // 使用显示名称进行下载，后端会处理文件名映射
    window.open(`/api/share/${code}/file/${file.name}`, '_blank')
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !shareData) {
    return (
      <div className="guest-container">
        <Card style={{ margin: isMobile ? '16px' : '24px auto' }}>
          <Empty 
            description="分享链接无效或已过期"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="guest-container">
      <Card style={{ margin: isMobile ? '16px' : '24px auto' }}>
        <div className="guest-header">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div className="guest-title">
              <FolderOpenOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              {shareData?.alias || '未知文件夹'}
            </div>
            <div className="guest-info">
              <Text type="secondary">
                访客码: <Text strong>{code}</Text>
              </Text>
            </div>
            {shareData.share && (
              <>
                <div className="guest-info">
                  <Text type="secondary">
                    过期时间: <Text strong>{dayjs(shareData.share.expireTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
                  </Text>
                </div>
                <div className="guest-info">
                  <Text type={dayjs(shareData.share.expireTime).isBefore(dayjs()) ? "danger" : "secondary"}>
                    状态: <Text strong>{dayjs(shareData.share.expireTime).isBefore(dayjs()) ? "已过期" : "有效"}</Text>
                  </Text>
                </div>
              </>
            )}
            {shareData.files && shareData.files.length > 0 && (
              <Button 
                type="primary" 
                icon={<DownloadOutlined />}
                size={isMobile ? "middle" : "large"}
                onClick={handleDownloadAll}
                loading={downloading}
                className="download-all-btn"
                block={isMobile}
              >
                下载全部文件
              </Button>
            )}
          </Space>
        </div>

        {shareData.files && shareData.files.length > 0 ? (
          <List
            header={<div>文件列表 ({shareData.files.length})</div>}
            bordered
            dataSource={shareData.files}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button 
                    type="link" 
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownloadFile(item)}
                  >
                    下载
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<FileOutlined style={{ color: '#1890ff' }} />}
                  title={item.name}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty 
            description="此文件夹暂无文件"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>
    </div>
  )
}

export default GuestAccess