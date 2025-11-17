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
  Tag,
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

const { Title, Text } = Typography

const Dashboard = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isShareModalVisible, setIsShareModalVisible] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [shareInfo, setShareInfo] = useState(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 获取文件夹列表
  const { data: folders = [], isLoading } = useQuery(
    'folders',
    async () => {
      const response = await api.get('/folders')
      return response.data
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
        queryClient.invalidateQueries('folders')
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
        queryClient.invalidateQueries('folders')
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
        message.success('分享链接创建成功')
        setShareInfo(data)
        setIsShareModalVisible(true)
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
    setSelectedFolder(folder)
    createShareMutation.mutate({ folderId: folder.id })
  }

  const handleCopyShareLink = () => {
    if (shareInfo) {
      // 使用配置的基础URL或当前origin
      const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin
      const shareUrl = `${baseUrl}/guest/${shareInfo.code}`
      
      // 使用多种方法尝试复制到剪贴板
      const copyToClipboard = (text) => {
        // 优先使用现代API
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            () => {
              message.success('分享链接已复制到剪贴板')
            },
            () => {
              // 如果失败，尝试备用方法
              fallbackCopyToClipboard(text)
            }
          )
        } else {
          // 使用备用方法
          fallbackCopyToClipboard(text)
        }
      }
      
      // 备用复制方法
      const fallbackCopyToClipboard = (text) => {
        try {
          // 创建临时文本区域
          const textArea = document.createElement('textarea')
          textArea.value = text
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          textArea.style.top = '-999999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          
          const successful = document.execCommand('copy')
          document.body.removeChild(textArea)
          
          if (successful) {
            message.success('分享链接已复制到剪贴板')
          } else {
            message.error('复制失败，请手动复制链接')
            // 显示链接供用户手动复制
            Modal.info({
              title: '分享链接',
              content: (
                <div>
                  <p>请手动复制以下链接：</p>
                  <Input.TextArea 
                    value={shareUrl} 
                    readOnly 
                    style={{ marginTop: 8 }}
                  />
                </div>
              ),
              width: 500
            })
          }
        } catch (err) {
          message.error('复制失败，请手动复制链接')
          // 显示链接供用户手动复制
          Modal.info({
            title: '分享链接',
            content: (
              <div>
                <p>请手动复制以下链接：</p>
                <Input.TextArea 
                  value={shareUrl} 
                  readOnly 
                  style={{ marginTop: 8 }}
                />
              </div>
            ),
            width: 500
          })
        }
      }
      
      copyToClipboard(shareUrl)
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
            title="确定要删除这个文件夹吗?"
            onConfirm={() => handleDeleteFolder(record.id)}
            okText="确定"
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
              <Text strong>访客码:</Text>
            </div>
            <div className="share-code">
              {shareInfo.code}
            </div>
            <div style={{ margin: '16px 0' }}>
              <QRCode value={`${window.location.origin}/guest/${shareInfo.code}`} />
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

export default Dashboard