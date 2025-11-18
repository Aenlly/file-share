import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Table, 
  Button, 
  Tag, 
  Space, 
  message, 
  Modal, 
  DatePicker, 
  Input,
  Tooltip,
  Popconfirm,
  Typography,
  Empty,
  Spin,
  Checkbox
} from 'antd'
import { 
  ShareAltOutlined, 
  DeleteOutlined, 
  EditOutlined,
  CopyOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  LinkOutlined
} from '@ant-design/icons'
import api from '../utils/api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const ShareManagement = () => {
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [currentShare, setCurrentShare] = useState(null)
  const [customExpiration, setCustomExpiration] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [batchExtendModalVisible, setBatchExtendModalVisible] = useState(false)
  const [batchExtendDays, setBatchExtendDays] = useState(7)

  // 加载分享列表
  const fetchShares = async () => {
    setLoading(true)
    try {
      const response = await api.get('/shares')
      // 后端直接返回数组，而不是包装在shares字段中
      setShares(response.data || [])
    } catch (error) {
      message.error('获取分享列表失败')
      console.error('获取分享列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShares()
  }, [])

  // 复制分享链接
  const copyShareLink = (share) => {
    const shareUrl = `${window.location.origin}/guest`
    const accessCode = share.code
    
    // 复制可以直接在浏览器中访问的完整链接
    const shareText = `${shareUrl}?code=${accessCode}`
    
    navigator.clipboard.writeText(shareText)
      .then(() => message.success('分享链接已复制到剪贴板'))
      .catch(() => message.error('复制失败'))
  }

  // 延长有效期
  const extendExpiration = async (shareId, days) => {
    try {
      // 后端期望的是expireInMs参数
      const expireInMs = days * 24 * 60 * 60 * 1000 // 天数转换为毫秒
      await api.put(`/shares/${shareId}`, { expireInMs })
      message.success('有效期已延长')
      fetchShares()
    } catch (error) {
      message.error('延长有效期失败')
      console.error('延长有效期失败:', error)
    }
  }

  // 设置自定义过期时间
  const setCustomExpirationTime = async () => {
    if (!currentShare || !customExpiration) {
      message.error('请选择过期时间')
      return
    }

    try {
      // 计算从现在到自定义过期时间的毫秒数
      const now = dayjs()
      const expireInMs = customExpiration.diff(now, 'millisecond')
      
      if (expireInMs <= 0) {
        message.error('过期时间必须在未来')
        return
      }
      
      await api.put(`/shares/${currentShare.id}`, { expireInMs })
      message.success('过期时间已更新')
      setEditModalVisible(false)
      setCurrentShare(null)
      setCustomExpiration(null)
      fetchShares()
    } catch (error) {
      message.error('更新过期时间失败')
      console.error('更新过期时间失败:', error)
    }
  }

  // 禁用分享链接
  const disableShare = async (shareId) => {
    try {
      await api.delete(`/shares/${shareId}`)
      message.success('分享链接已禁用')
      fetchShares()
    } catch (error) {
      message.error('禁用分享链接失败')
      console.error('禁用分享链接失败:', error)
    }
  }

  // 批量删除分享链接
  const batchDeleteShares = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的分享链接')
      return
    }

    try {
      const promises = selectedRowKeys.map(id => api.delete(`/shares/${id}`))
      await Promise.all(promises)
      message.success(`已成功删除 ${selectedRowKeys.length} 个分享链接`)
      setSelectedRowKeys([])
      fetchShares()
    } catch (error) {
      message.error('批量删除失败')
      console.error('批量删除失败:', error)
    }
  }

  // 批量延长有效期
  const batchExtendExpiration = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要延长有效期的分享链接')
      return
    }

    try {
      const expireInMs = batchExtendDays * 24 * 60 * 60 * 1000 // 天数转换为毫秒
      const promises = selectedRowKeys.map(id => api.put(`/shares/${id}`, { expireInMs }))
      await Promise.all(promises)
      message.success(`已成功延长 ${selectedRowKeys.length} 个分享链接的有效期`)
      setSelectedRowKeys([])
      setBatchExtendModalVisible(false)
      fetchShares()
    } catch (error) {
      message.error('批量延长有效期失败')
      console.error('批量延长有效期失败:', error)
    }
  }

  // 打开编辑模态框
  const openEditModal = (share) => {
    setCurrentShare(share)
    setCustomExpiration(dayjs(share.expireTime))
    setEditModalVisible(true)
  }

  // 获取状态标签
  const getStatusTag = (expireTime) => {
    const now = dayjs()
    const expiration = dayjs(expireTime)
    
    if (expiration.isBefore(now)) {
      return <Tag color="red">已过期</Tag>
    } else if (expiration.diff(now, 'day') <= 1) {
      return <Tag color="orange">即将过期</Tag>
    } else {
      return <Tag color="green">有效</Tag>
    }
  }

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
    getCheckboxProps: (record) => ({
      disabled: record.isExpired || dayjs(record.expireTime).isBefore(dayjs()),
    }),
  }

  // 表格列定义
  const columns = [
    {
      title: '文件夹',
      dataIndex: 'folderAlias',
      key: 'folderAlias',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: '访问链接',
      key: 'shareUrl',
      render: (record) => (
        <Text code copyable={{ text: `${window.location.origin}/guest?code=${record.code}` }}>
          {window.location.origin}/guest?code={record.code}
        </Text>
      )
    },
    {
      title: '访问码',
      dataIndex: 'code',
      key: 'code',
      render: (code) => (
        <Space>
          <Text code>{code}</Text>
          <Tooltip title="复制分享链接">
            <Button 
              type="text" 
              size="small" 
              icon={<CopyOutlined />} 
              onClick={() => copyShareLink({ code })}
            />
          </Tooltip>
        </Space>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'id',
      key: 'createdAt',
      render: (id) => (
        <Tooltip title={dayjs(id).format('YYYY-MM-DD HH:mm:ss')}>
          <Text>{dayjs(id).fromNow()}</Text>
        </Tooltip>
      )
    },
    {
      title: '过期时间',
      dataIndex: 'expireTime',
      key: 'expireTime',
      render: (time) => (
        <Tooltip title={dayjs(time).format('YYYY-MM-DD HH:mm:ss')}>
          <Text>{dayjs(time).fromNow()}</Text>
        </Tooltip>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => getStatusTag(record.expireTime)
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => {
        const isExpired = record.isExpired || dayjs(record.expireTime).isBefore(dayjs())
        
        return (
          <Space>
            <Tooltip title="设置自定义过期时间">
              <Button 
                type="text" 
                size="small" 
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
            
            <Tooltip title="延长7天">
              <Button 
                type="text" 
                size="small" 
                icon={<CalendarOutlined />}
                onClick={() => extendExpiration(record.id, 7)}
                disabled={isExpired}
              />
            </Tooltip>
            
            <Tooltip title="延长30天">
              <Button 
                type="text" 
                size="small" 
                icon={<ClockCircleOutlined />}
                onClick={() => extendExpiration(record.id, 30)}
                disabled={isExpired}
              />
            </Tooltip>
            
            <Popconfirm
              title="确定要禁用此分享链接吗？"
              description="禁用后，访问码将立即失效"
              onConfirm={() => disableShare(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="禁用分享">
                <Button 
                  type="text" 
                  size="small" 
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      }
    }
  ]

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4}>
            <ShareAltOutlined /> 分享链接管理
          </Title>
          <Space>
            {selectedRowKeys.length > 0 && (
              <Space>
                <Text>已选择 {selectedRowKeys.length} 项</Text>
                <Button 
                  size="small"
                  onClick={() => setBatchExtendModalVisible(true)}
                >
                  批量延长有效期
                </Button>
                <Popconfirm
                  title="确定要删除选中的分享链接吗？"
                  description="删除后，访问码将立即失效"
                  onConfirm={batchDeleteShares}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button 
                    size="small"
                    danger
                  >
                    批量删除
                  </Button>
                </Popconfirm>
              </Space>
            )}
            <Button icon={<LinkOutlined />} onClick={fetchShares}>
              刷新列表
            </Button>
          </Space>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
          </div>
        ) : shares.length === 0 ? (
          <Empty 
            description="暂无分享链接" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table 
            columns={columns} 
            dataSource={shares} 
            rowKey="id"
            rowSelection={rowSelection}
            pagination={{ 
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
          />
        )}
      </Card>

      {/* 编辑过期时间模态框 */}
      <Modal
        title="设置自定义过期时间"
        open={editModalVisible}
        onOk={setCustomExpirationTime}
        onCancel={() => {
          setEditModalVisible(false)
          setCurrentShare(null)
          setCustomExpiration(null)
        }}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ margin: '20px 0' }}>
          <Text>选择新的过期时间：</Text>
          <DatePicker
            showTime
            style={{ width: '100%', marginTop: 8 }}
            value={customExpiration}
            onChange={setCustomExpiration}
            disabledDate={(current) => current && current < dayjs().endOf('day')}
          />
        </div>
      </Modal>

      {/* 批量延长有效期模态框 */}
      <Modal
        title="批量延长有效期"
        open={batchExtendModalVisible}
        onOk={batchExtendExpiration}
        onCancel={() => {
          setBatchExtendModalVisible(false)
          setBatchExtendDays(7)
        }}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>已选择 {selectedRowKeys.length} 个分享链接</Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text>延长天数:</Text>
          <Button.Group style={{ marginLeft: 8 }}>
            <Button 
              type={batchExtendDays === 1 ? 'primary' : 'default'}
              onClick={() => setBatchExtendDays(1)}
            >
              1天
            </Button>
            <Button 
              type={batchExtendDays === 7 ? 'primary' : 'default'}
              onClick={() => setBatchExtendDays(7)}
            >
              7天
            </Button>
            <Button 
              type={batchExtendDays === 30 ? 'primary' : 'default'}
              onClick={() => setBatchExtendDays(30)}
            >
              30天
            </Button>
          </Button.Group>
        </div>
        <div>
          <Text type="secondary">
            分享链接将延长 {batchExtendDays} 天有效期
          </Text>
        </div>
      </Modal>
    </div>
  )
}

export default ShareManagement