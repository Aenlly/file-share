import { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Table, 
  Modal, 
  Form, 
  Input, 
  message, 
  Space, 
  Popconfirm,
  Tooltip,
  QRCode,
  Typography
} from 'antd'
import { 
  PlusOutlined, 
  ShareAltOutlined, 
  DeleteOutlined,
  FolderOpenOutlined,
  CopyOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import dayjs from 'dayjs'
import api from '../utils/api'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

const FolderManagement = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isShareModalVisible, setIsShareModalVisible] = useState(false)
  const [shareInfo, setShareInfo] = useState(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 获取文件夹列表（只显示顶级文件夹）
  const { user } = useAuthStore()
  const { data: folders = [], isLoading } = useQuery(
    ['folders', user?.username || 'anonymous'],
    async () => {
      const response = await api.get('/folders')
      // 只显示没有父文件夹的顶级文件夹
      return response.data.filter(folder => !folder.parentId)
    },
    {
      enabled: !!user
    }
  )

  // 创建文件夹
  const createFolderMutation = useMutation(
    async (folderData) => {
      const response = await api.post('/folders', folderData)
      return response.data
    },
    {
      onSuccess: () => {
        message.success('文件夹创建成功')
        setIsModalVisible(false)
        form.resetFields()
        queryClient.invalidateQueries(['folders', user?.username || 'anonymous'])
        queryClient.invalidateQueries(['userStats', user?.username])
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '创建文件夹失败')
      }
    }
  )

  // 删除文件夹
  const deleteFolderMutation = useMutation(
    async (folderId) => {
      await api.delete(`/folders/${folderId}`)
    },
    {
      onSuccess: () => {
        message.success('文件夹删除成功')
        queryClient.invalidateQueries(['folders', user?.username || 'anonymous'])
        queryClient.invalidateQueries(['userStats', user?.username])
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '删除文件夹失败')
      }
    }
  )

  // 创建分享
  const createShareMutation = useMutation(
    async (shareData) => {
      const response = await api.post('/shares', shareData)
      return response.data
    },
    {
      onSuccess: (data) => {
        const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin
        const shareUrl = `${baseUrl}/guest`
        const shareText = `${shareUrl}?code=${data.code}`
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareText).then(
            () => {
              message.success('分享链接创建成功并已复制到剪贴板')
              setShareInfo(data)
              setIsShareModalVisible(true)
            },
            () => {
              message.success('分享链接创建成功')
              setShareInfo(data)
              setIsShareModalVisible(true)
            }
          )
        } else {
          message.success('分享链接创建成功')
          setShareInfo(data)
          setIsShareModalVisible(true)
        }
        
        queryClient.invalidateQueries(['userStats', user?.username])
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '创建分享失败')
      }
    }
  )

  const handleCreateFolder = () => {
    form.validateFields().then(values => {
      createFolderMutation.mutate(values)
    })
  }

  const handleDeleteFolder = (folderId) => {
    deleteFolderMutation.mutate(folderId)
  }

  const handleShareFolder = (folder) => {
    createShareMutation.mutate({ folderId: folder.id })
  }

  const handleCopyShareLink = () => {
    if (shareInfo) {
      const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin
      const shareUrl = `${baseUrl}/guest`
      const shareText = `${shareUrl}?code=${shareInfo.code}`
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareText).then(
          () => message.success('分享链接已复制到剪贴板'),
          () => message.error('复制失败')
        )
      } else {
        message.error('浏览器不支持自动复制')
      }
    }
  }

  const columns = [
    {
      title: '文件夹名称',
      dataIndex: 'alias',
      key: 'alias',
      render: (text) => (
        <Space>
          <FolderOpenOutlined style={{ color: '#1890ff' }} />
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'id',
      key: 'createTime',
      render: (id) => dayjs(id).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看文件夹">
            <Button 
              type="primary" 
              icon={<EyeOutlined />} 
              size="small"
              onClick={() => navigate(`/folder/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="分享文件夹">
            <Button 
              icon={<ShareAltOutlined />} 
              size="small"
              onClick={() => handleShareFolder(record)}
            />
          </Tooltip>
          <Popconfirm
            title={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: 8 }}>确定要删除这个文件夹吗?</div>
                <div style={{ color: '#faad14', fontSize: 12 }}>
                  📁 文件夹将被移至回收站，可在30天内恢复
                </div>
              </div>
            }
            onConfirm={() => handleDeleteFolder(record.id)}
            okText="确定删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
          >
            <Tooltip title="删除文件夹">
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

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

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 16 : 0
      }}>
        <Title level={2} style={{ margin: 0 }}>文件夹管理</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setIsModalVisible(true)}
          block={isMobile}
        >
          新建文件夹
        </Button>
      </div>

      <Card>
        <Table 
          columns={columns} 
          dataSource={folders} 
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: isMobile ? 800 : undefined }}
        />
      </Card>

      <Modal
        title="新建文件夹"
        open={isModalVisible}
        onOk={handleCreateFolder}
        onCancel={() => {
          setIsModalVisible(false)
          form.resetFields()
        }}
        confirmLoading={createFolderMutation.isLoading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="alias"
            label="文件夹名称"
            rules={[{ required: true, message: '请输入文件夹名称' }]}
          >
            <Input placeholder="请输入文件夹名称" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="文件夹分享"
        open={isShareModalVisible}
        onCancel={() => setIsShareModalVisible(false)}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={handleCopyShareLink}>
            复制链接
          </Button>,
          <Button key="close" onClick={() => setIsShareModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {shareInfo && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>访问链接:</Text>
            </div>
            <div className="share-url" style={{ marginBottom: 16, wordBreak: 'break-all' }}>
              {window.location.origin}/guest
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>访问码:</Text>
            </div>
            <div className="share-code">
              {shareInfo.code}
            </div>
            <div style={{ margin: '16px 0' }}>
              <QRCode value={`${window.location.origin}/guest?code=${shareInfo.code}`} />
            </div>
            <div>
              <Text type="secondary">
                有效期至: {dayjs(shareInfo.expireTime).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default FolderManagement
