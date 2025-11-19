import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
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
  KeyOutlined,
  LeftOutlined
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
  const [refreshKey, setRefreshKey] = useState(0) // 添加刷新键来强制重新渲染
  const [currentFolderId, setCurrentFolderId] = useState(null) // 添加当前文件夹ID状态
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  
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

  // 获取URL参数中的folderId
  const folderIdFromUrl = searchParams.get('folderId')
  
  // 创建一个函数来获取当前URL参数
  const getCurrentUrlParams = () => {
    const params = new URLSearchParams(location.search)
    return {
      code: params.get('code'),
      folderId: params.get('folderId')
    }
  }
  
  // 当URL参数变化时，重新获取访问码
  useEffect(() => {
    const codeFromUrl = searchParams.get('code')
    if (codeFromUrl && codeFromUrl !== accessCode) {
      setAccessCode(codeFromUrl)
      setHasSubmitted(true)
    }
  }, [searchParams])
  
  // 获取分享内容
  const { data: shareData, isLoading, error, refetch } = useQuery(
    ['share', currentFolderId, refreshKey, accessCode], // 使用状态中的currentFolderId
    async () => {
      // 使用状态中的currentFolderId，而不是从URL解析
      const url = currentFolderId 
        ? `/share/${accessCode}?folderId=${currentFolderId}`
        : `/share/${accessCode}`
      const response = await api.get(url)
      return response.data
    },
    {
      enabled: hasSubmitted && !!accessCode, // 当已提交访问码且有访问码时才执行查询
      retry: false
    }
  )

  // 当location变化时，强制重新获取数据
  useEffect(() => {
    // 当URL变化时，强制重新获取数据
    if (hasSubmitted && accessCode) {
      refetch()
    }
  }, [location, hasSubmitted, accessCode, refetch])

  // 处理访问码提交
  const handleAccessCodeSubmit = (value) => {
    if (!value) {
      message.error('请输入访问码')
      return
    }
    
    // 访问码区分大小写，直接使用原始输入
    setAccessCode(value)
    setHasSubmitted(true)
    
    // 不需要手动调用refetch，因为useQuery会在accessCode变化时自动重新执行
  }

  const handleDownloadAll = async () => {
    setDownloading(true)
    try {
      // 如果有当前文件夹ID，则传递给后端
      const downloadUrl = currentFolderId 
        ? `/api/share/${accessCode}/download?folderId=${currentFolderId}`
        : `/api/share/${accessCode}/download`;
      window.open(downloadUrl, '_blank')
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
      <Card 
        style={{ margin: isMobile ? '16px' : '24px auto' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>分享文件夹</span>
            <Button 
              type="link" 
              icon={<LeftOutlined />}
              onClick={() => {
                const { code: currentCode, folderId } = getCurrentUrlParams();
                if (folderId) {
                  // 返回到根文件夹
                  const rootUrl = `/guest?code=${currentCode}`;
                  window.history.pushState({}, '', rootUrl);
                  // 直接更新状态，强制重新获取数据
                  setAccessCode(currentCode);
                  setCurrentFolderId(null); // 清除文件夹ID，返回根目录
                  setRefreshKey(prev => prev + 1);
                } else {
                  // 返回到访问码输入页面
                  setHasSubmitted(false);
                }
              }}
            >
              {folderIdFromUrl ? '返回根目录' : '重新输入'}
            </Button>
          </div>
        }
      >
        <div className="guest-header">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div className="guest-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <FolderOpenOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                {shareData?.alias || '未知文件夹'}
              </div>
              {folderIdFromUrl && (
                <Button 
                  type="link" 
                  icon={<LeftOutlined />}
                  onClick={() => {
                    // 返回到父文件夹
                    const { code: currentCode } = getCurrentUrlParams();
                    const parentUrl = `/guest?code=${currentCode}`;
                    window.history.pushState({}, '', parentUrl);
                    // 直接更新状态，强制重新获取数据
                    setAccessCode(currentCode);
                    setCurrentFolderId(null); // 清除文件夹ID，返回根目录
                    setRefreshKey(prev => prev + 1);
                  }}
                  size="small"
                >
                  返回上级
                </Button>
              )}
            </div>
            <div className="guest-info">
              <Text type="secondary">
                访客码: <Text strong>{accessCode || searchParams.get('code')}</Text>
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

        {/* 调试信息 */}
        {console.log('Share data:', shareData)}
        {/* 子文件夹列表 */}
        {shareData.subFolders && shareData.subFolders.length > 0 && (
          <List
            header={<div>子文件夹 ({shareData.subFolders.length})</div>}
            bordered
            style={{ marginBottom: 16 }}
            dataSource={shareData.subFolders}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button 
                    type="link" 
                    icon={<FolderOpenOutlined />}
                    onClick={() => {
                      // 更新URL参数，触发重新查询
                      const { code: currentCode } = getCurrentUrlParams();
                      const newUrl = `/guest?code=${currentCode}&folderId=${item.id}`;
                      window.history.pushState({}, '', newUrl);
                      // 直接更新状态，强制重新获取数据
                      setAccessCode(currentCode);
                      setCurrentFolderId(item.id); // 设置当前文件夹ID
                      setRefreshKey(prev => prev + 1);
                    }}
                  >
                    打开
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<FolderOpenOutlined style={{ color: '#1890ff' }} />}
                  title={item.alias}
                />
              </List.Item>
            )}
          />
        )}

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