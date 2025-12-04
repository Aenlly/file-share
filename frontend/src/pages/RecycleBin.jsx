import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Modal, message, Tag, Empty } from 'antd'
import { DeleteOutlined, RollbackOutlined, ClearOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import api from '../utils/api'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const RecycleBin = () => {
  const [isMobile, setIsMobile] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 获取回收站文件列表
  const { data: files = [], isLoading, refetch } = useQuery(
    'recycleBin',
    async () => {
      const response = await api.get('/folders/trash')
      // 确保返回数组
      return Array.isArray(response.data?.data) ? response.data.data : []
    }
  )

  // 恢复文件
  const restoreMutation = useMutation(
    async (fileId) => {
      const response = await api.post(`/folders/trash/restore/${fileId}`)
      return response.data
    },
    {
      onSuccess: () => {
        message.success('文件已恢复')
        refetch()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '恢复失败')
      }
    }
  )

  // 永久删除文件
  const deleteMutation = useMutation(
    async (fileId) => {
      const response = await api.delete(`/folders/trash/${fileId}`)
      return response.data
    },
    {
      onSuccess: () => {
        message.success('文件已永久删除')
        refetch()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '删除失败')
      }
    }
  )

  // 清空回收站
  const clearMutation = useMutation(
    async () => {
      const response = await api.delete('/folders/trash/clear')
      return response.data
    },
    {
      onSuccess: (data) => {
        message.success(data.message || '回收站已清空')
        refetch()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '清空失败')
      }
    }
  )

  const handleRestore = (file) => {
    Modal.confirm({
      title: '恢复文件',
      content: `确定要恢复文件 "${file.originalName}" 吗？`,
      okText: '恢复',
      cancelText: '取消',
      onOk: () => {
        restoreMutation.mutate(file.id)
      }
    })
  }

  const handleDelete = (file) => {
    Modal.confirm({
      title: '永久删除',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>确定要永久删除文件 "{file.originalName}" 吗？</p>
          <p style={{ color: '#ff4d4f', marginTop: 8 }}>
            ⚠️ 警告：删除后将无法找回！
          </p>
        </div>
      ),
      okText: '永久删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        deleteMutation.mutate(file.id)
      }
    })
  }

  const handleClearAll = () => {
    if (files.length === 0) {
      message.warning('回收站已经是空的')
      return
    }

    Modal.confirm({
      title: '清空回收站',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>确定要清空回收站吗？这将永久删除 {files.length} 个文件。</p>
          <p style={{ color: '#ff4d4f', marginTop: 8 }}>
            ⚠️ 警告：删除后将无法找回！
          </p>
        </div>
      ),
      okText: '清空回收站',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        clearMutation.mutate()
      }
    })
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getExpiryStatus = (deletedAt) => {
    const deletedDate = dayjs(deletedAt)
    const expiryDate = deletedDate.add(30, 'day')
    const daysLeft = expiryDate.diff(dayjs(), 'day')
    
    if (daysLeft <= 0) {
      return { text: '即将删除', color: 'red' }
    } else if (daysLeft <= 7) {
      return { text: `${daysLeft}天后删除`, color: 'orange' }
    } else {
      return { text: `${daysLeft}天后删除`, color: 'default' }
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'originalName',
      key: 'name',
      ellipsis: true,
      width: isMobile ? 150 : undefined,
      render: (text, record) => {
        const isFolder = record.itemType === 'folder'
        const displayName = isFolder 
          ? record.folderAlias 
          : (text || '').replace(/\.deleted_.*$/, '')
        
        return (
          <span style={{ fontSize: isMobile ? 12 : 14 }}>
            {isFolder && '📁 '}
            {displayName}
            {isFolder && record.fileCount > 0 && (
              <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                ({record.fileCount} 个文件)
              </span>
            )}
          </span>
        )
      }
    },
    {
      title: '类型',
      dataIndex: 'itemType',
      key: 'itemType',
      width: isMobile ? 60 : 80,
      render: (type) => (
        <Tag color={type === 'folder' ? 'blue' : 'default'} style={{ fontSize: isMobile ? 11 : 12 }}>
          {type === 'folder' ? '文件夹' : '文件'}
        </Tag>
      )
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: isMobile ? 70 : 100,
      render: (size, record) => {
        if (record.itemType === 'folder') {
          return <span style={{ fontSize: isMobile ? 11 : 14, color: '#999' }}>-</span>
        }
        return <span style={{ fontSize: isMobile ? 11 : 14 }}>{formatFileSize(size)}</span>
      }
    },
    ...(!isMobile ? [{
      title: '删除时间',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      width: 180,
      render: (deletedAt) => dayjs(deletedAt).format('YYYY-MM-DD HH:mm:ss')
    }] : []),
    {
      title: '过期时间',
      dataIndex: 'deletedAt',
      key: 'expiry',
      width: isMobile ? 90 : 120,
      render: (deletedAt) => {
        const status = getExpiryStatus(deletedAt)
        return <Tag color={status.color} style={{ fontSize: isMobile ? 11 : 12 }}>{status.text}</Tag>
      }
    },
    {
      title: '操作',
      key: 'actions',
      fixed: isMobile ? 'right' : false,
      width: isMobile ? 100 : 180,
      render: (_, record) => {
        if (isMobile) {
          return (
            <Space direction="vertical" size="small">
              <Button 
                size="small"
                icon={<RollbackOutlined />}
                onClick={() => handleRestore(record)}
                block
              >
                恢复
              </Button>
              <Button 
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
                block
              >
                删除
              </Button>
            </Space>
          )
        }
        
        return (
          <Space>
            <Button 
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRestore(record)}
            >
              恢复
            </Button>
            <Button 
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              永久删除
            </Button>
          </Space>
        )
      }
    }
  ]

  return (
    <div style={{ padding: isMobile ? '8px' : '24px' }}>
      <Card>
        <div style={{ 
          marginBottom: 16, 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 0
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 24 }}>回收站</h2>
            <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: isMobile ? 12 : 14 }}>
              文件将在删除后保留30天，之后自动永久删除
            </p>
          </div>
          {files.length > 0 && (
            <Button 
              danger
              icon={<ClearOutlined />}
              onClick={handleClearAll}
              loading={clearMutation.isLoading}
              block={isMobile}
            >
              清空回收站
            </Button>
          )}
        </div>

        {files.length === 0 ? (
          <Empty 
            description="回收站是空的"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: isMobile ? '40px 0' : '60px 0' }}
          />
        ) : (
          <Table 
            columns={columns} 
            dataSource={files} 
            rowKey="id"
            loading={isLoading}
            pagination={{ 
              pageSize: isMobile ? 5 : 10,
              simple: isMobile,
              showTotal: (total) => `共 ${total} 个文件`
            }}
            scroll={{ x: isMobile ? 600 : undefined }}
          />
        )}
      </Card>
    </div>
  )
}

export default RecycleBin
