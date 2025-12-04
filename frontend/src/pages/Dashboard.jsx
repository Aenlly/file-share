import { useState, useEffect } from 'react'
import { 
  Card, 
  Row,
  Col,
  Statistic,
  Typography,
  Spin
} from 'antd'
import { 
  FolderOutlined,
  FileOutlined,
  DeleteOutlined,
  ShareAltOutlined,
  DatabaseOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery } from 'react-query'
import api from '../utils/api'
import { useAuthStore } from '../stores/authStore'

const { Title } = Typography

const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // 获取统计数据
  const { data: stats, isLoading } = useQuery(
    ['userStats', user?.username],
    async () => {
      const response = await api.get('/users/stats')
      return response.data
    },
    {
      enabled: !!user,
      refetchInterval: 30000 // 每30秒刷新一次
    }
  )

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  // 检测是否为移动设备
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载统计数据中..." />
      </div>
    )
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>数据统计</Title>

      <Row gutter={[16, 16]}>
        {/* 文件夹统计 */}
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            onClick={() => navigate('/folders')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="文件夹"
              value={stats?.folders || 0}
              prefix={<FolderOutlined style={{ color: '#1890ff' }} />}
              suffix="个"
            />
          </Card>
        </Col>

        {/* 文件统计 */}
        <Col xs={24} sm={12} lg={8}>
          <Card hoverable>
            <Statistic
              title="文件"
              value={stats?.files || 0}
              prefix={<FileOutlined style={{ color: '#52c41a' }} />}
              suffix="个"
            />
          </Card>
        </Col>

        {/* 存储空间统计 */}
        <Col xs={24} sm={12} lg={8}>
          <Card hoverable>
            <Statistic
              title="存储空间"
              value={formatFileSize(stats?.totalSize || 0)}
              prefix={<DatabaseOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>

        {/* 回收站统计 */}
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            onClick={() => navigate('/recycle-bin')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="回收站"
              value={stats?.recycleBin || 0}
              prefix={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
              suffix="个待删除"
            />
          </Card>
        </Col>

        {/* 分享链接统计 */}
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            onClick={() => navigate('/shares')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="分享链接"
              value={stats?.shares || 0}
              prefix={<ShareAltOutlined style={{ color: '#fa8c16' }} />}
              suffix="个"
            />
          </Card>
        </Col>

        {/* 活跃分享统计 */}
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            onClick={() => navigate('/shares')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="活跃分享"
              value={stats?.activeShares || 0}
              prefix={<ClockCircleOutlined style={{ color: '#13c2c2' }} />}
              suffix="个未过期"
            />
          </Card>
        </Col>
      </Row>

      {/* 快捷操作提示 */}
      <Card 
        title="快捷操作" 
        style={{ marginTop: 24 }}
        bodyStyle={{ padding: isMobile ? 12 : 24 }}
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div style={{ color: '#666', lineHeight: '2' }}>
              <div>• 点击"文件夹"卡片可以查看和管理所有文件夹</div>
              <div>• 点击"回收站"卡片可以查看和恢复已删除的文件</div>
              <div>• 点击"分享链接"卡片可以管理所有分享链接</div>
              <div>• 使用左侧菜单可以快速访问各个功能模块</div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default Dashboard