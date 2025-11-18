import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { 
  Card, 
  Button, 
  List, 
  Typography, 
  message, 
  Space,
  Spin,
  Empty,
  Input,
  Form
} from 'antd'
import { 
  DownloadOutlined, 
  FileOutlined, 
  FolderOpenOutlined,
  KeyOutlined
} from '@ant-design/icons'
import { useQuery, useQueryClient } from 'react-query'
import dayjs from 'dayjs'
import api from '../utils/api'

const { Title, Text } = Typography
const { Search } = Input

const GuestAccess = () => {
  const { code } = useParams()
  const [accessCode, setAccessCode] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  
  // 检查URL参数中是否有访问码
  useEffect(() => {
    // 优先使用URL参数中的访问码
    const codeFromUrl = searchParams.get('code') || code
    if (codeFromUrl) {
      handleAccessCodeSubmit(codeFromUrl)
    }
  }, [])

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
  const { data: shareData, isLoading, error, refetch } = useQuery(
    ['share', accessCode],
    async () => {
      const response = await api.get(`/share/${accessCode}`)
      return response.data
    },
    {
      enabled: hasSubmitted && !!accessCode, // 当已提交访问码且有访问码时才执行查询
      retry: false
    }
  )

  // 处理访问码提交
  const handleAccessCodeSubmit = (value) => {
    if (!value) {
      message.error('请输入访问码')
      return
    }
    
    // 访问码区分大小写，直接使用原始输入
    setAccessCode(value)
    setHasSubmitted(true)
    
    // 使用refetch来触发查询
    refetch()
  }

  const handleDownloadAll = async () => {
    setDownloading(true)
    try {
      window.open(`/api/share/${accessCode}/download`, '_blank')
    } catch (error) {
      message.error('下载失败')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadFile = (file) => {
    // 使用显示名称进行下载，后端会处理文件名映射
    window.open(`/api/share/${accessCode}/file/${file.name}`, '_blank')
  }

  // 如果还没有提交访问码，显示访问码输入界面
  if (!hasSubmitted) {
    return (
      <div className="guest-container">
        <Card 
          title="文件分享访问" 
          style={{ margin: isMobile ? '16px' : '24px auto', maxWidth: 500 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <KeyOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
            <Title level={4}>请输入访问码</Title>
            <Text type="secondary">
              您已收到一个文件分享链接，请输入访问码以查看文件
            </Text>
          </div>
          
          <Search
            placeholder="请输入访问码"
            enterButton="访问"
            size="large"
            onSearch={handleAccessCodeSubmit}
            style={{ marginBottom: 16 }}
          />
          
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              访问码区分大小写
            </Text>
          </div>
        </Card>
      </div>
    )
  }

  // 如果已提交访问码，显示加载状态
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  // 如果访问码无效或已过期
  if (error || !shareData) {
    return (
      <div className="guest-container">
        <Card 
          title="访问失败" 
          style={{ margin: isMobile ? '16px' : '24px auto', maxWidth: 500 }}
        >
          <Empty 
            description="访问码无效或已过期"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={() => setHasSubmitted(false)}>
              重新输入访问码
            </Button>
          </Empty>
        </Card>
      </div>
    )
  }

  // 显示分享内容
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