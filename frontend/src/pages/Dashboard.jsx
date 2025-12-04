import { useState, useEffect } from 'react'
import { 
  Card, 
  Row,
  Col,
  Statistic,
  Typography,
  Spin,
  Table,
  Tag,
  Tabs
} from 'antd'
import { 
  FolderOutlined,
  FileOutlined,
  DeleteOutlined,
  ShareAltOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery } from 'react-query'
import api from '../utils/api'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  // 获取个人统计数据 - 定时刷新以显示实时数据
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

  // 获取全局统计数据（仅管理员）- 定时刷新
  const { data: globalStats, isLoading: globalLoading } = useQuery(
    'globalStats',
    async () => {
      const response = await api.get('/users/stats-all')
      return response.data
    },
    {
      enabled: isAdmin,
      refetchInterval: 60000 // 每60秒刷新一次
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

  // 用户列表表格列定义
  const userColumns = [
    {
      title: 'ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 60,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      )
    },
    {
      title: '文件夹',
      dataIndex: 'folders',
      key: 'folders',
      render: (val) => `${val} 个`
    },
    {
      title: '文件',
      dataIndex: 'files',
      key: 'files',
      render: (val) => `${val} 个`
    },
    {
      title: '存储使用',
      dataIndex: 'storageUsed',
      key: 'storageUsed',
      render: (val, record) => {
        const used = val || 0
        const quota = record.storageQuota || 10 * 1024 * 1024 * 1024
        const percentage = ((used / quota) * 100).toFixed(1)
        const color = percentage > 90 ? '#ff4d4f' : percentage > 70 ? '#faad14' : '#52c41a'
        return (
          <span>
            <span style={{ color }}>{formatFileSize(used)}</span>
            <span style={{ color: '#999', fontSize: '12px' }}> / {formatFileSize(quota)}</span>
            <div style={{ fontSize: '11px', color }}>({percentage}%)</div>
          </span>
        )
      }
    },
    {
      title: '分享',
      dataIndex: 'shares',
      key: 'shares',
      render: (val, record) => `${record.activeShares}/${val}`
    },
    {
      title: '回收站',
      dataIndex: 'recycleBin',
      key: 'recycleBin',
      render: (val) => `${val} 个`
    }
  ]

  if (isLoading || (isAdmin && globalLoading)) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载统计数据中..." />
      </div>
    )
  }

  // 管理员视图
  if (isAdmin) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 24 }}>
          <TeamOutlined /> 全局数据统计
        </Title>

        <Tabs
          defaultActiveKey="global"
          items={[
            {
              key: 'global',
              label: '全局统计',
              children: (
                <>
                  {/* 全局统计卡片 */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} sm={12} lg={6}>
                      <Card hoverable onClick={() => navigate('/users')} style={{ cursor: 'pointer' }}>
                        <Statistic
                          title="总用户数"
                          value={globalStats?.totals?.totalUsers || 0}
                          prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                          suffix="个"
                        />
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                      <Card hoverable>
                        <Statistic
                          title="总文件夹"
                          value={globalStats?.totals?.totalFolders || 0}
                          prefix={<FolderOutlined style={{ color: '#52c41a' }} />}
                          suffix="个"
                        />
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                      <Card hoverable>
                        <Statistic
                          title="总文件"
                          value={globalStats?.totals?.totalFiles || 0}
                          prefix={<FileOutlined style={{ color: '#722ed1' }} />}
                          suffix="个"
                        />
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                      <Card hoverable>
                        <Statistic
                          title="总存储使用"
                          value={formatFileSize(globalStats?.totals?.totalStorageUsed || 0)}
                          prefix={<DatabaseOutlined style={{ color: '#fa8c16' }} />}
                        />
                        <div style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
                          配额: {formatFileSize(globalStats?.totals?.totalStorageQuota || 0)}
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                      <Card hoverable onClick={() => navigate('/shares')} style={{ cursor: 'pointer' }}>
                        <Statistic
                          title="总分享链接"
                          value={globalStats?.totals?.totalShares || 0}
                          prefix={<ShareAltOutlined style={{ color: '#13c2c2' }} />}
                          suffix="个"
                        />
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={6}>
                      <Card hoverable>
                        <Statistic
                          title="活跃分享"
                          value={globalStats?.totals?.totalActiveShares || 0}
                          prefix={<ClockCircleOutlined style={{ color: '#eb2f96' }} />}
                          suffix="个"
                        />
                      </Card>
                    </Col>
                  </Row>

                  {/* 用户详细列表 */}
                  <Card title="用户详细统计">
                    <Table
                      columns={userColumns}
                      dataSource={globalStats?.users || []}
                      rowKey="userId"
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 800 }}
                    />
                  </Card>
                </>
              )
            },
            {
              key: 'personal',
              label: '我的统计',
              children: (
                <>
                  <PersonalStats 
                    stats={stats} 
                    navigate={navigate} 
                    formatFileSize={formatFileSize}
                    isMobile={isMobile}
                  />
                </>
              )
            }
          ]}
        />
      </div>
    )
  }

  // 普通用户视图
  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        <UserOutlined /> 我的数据统计
      </Title>
      <PersonalStats 
        stats={stats} 
        navigate={navigate} 
        formatFileSize={formatFileSize}
        isMobile={isMobile}
      />
    </div>
  )
}

// 个人统计组件
const PersonalStats = ({ stats, navigate, formatFileSize, isMobile }) => {
  return (
    <>
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
              suffix="个"
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
              suffix="个(7天内有访问)"
            />
          </Card>
        </Col>
      </Row>

      {/* 快捷操作提示 */}
      <Card 
        title="快捷操作" 
        style={{ marginTop: 24 }}
      >
        <div style={{ color: '#666', lineHeight: '2', padding: isMobile ? 0 : 8 }}>
          <div>• 点击"文件夹"卡片可以查看和管理所有文件夹</div>
          <div>• 点击"回收站"卡片可以查看和恢复已删除的文件</div>
          <div>• 点击"分享链接"卡片可以管理所有分享链接</div>
          <div>• 使用左侧菜单可以快速访问各个功能模块</div>
        </div>
      </Card>
    </>
  )
}

export default Dashboard