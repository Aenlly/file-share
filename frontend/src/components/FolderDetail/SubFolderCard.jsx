import { useState, useEffect } from 'react'
import { Card, Button, Table, Space, Popconfirm, Modal, Input, Typography, message } from 'antd'
import { FileOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'react-query'
import api from '../../utils/api'

const { Text } = Typography

const SubFolderCard = ({ folderId, subFolders, onRefresh }) => {
  const navigate = useNavigate()
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [subFolderName, setSubFolderName] = useState('')
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

  const createSubFolderMutation = useMutation(
    async (folderData) => {
      const response = await api.post('/folders', folderData)
      return response.data
    },
    {
      onSuccess: () => {
        message.success('子文件夹创建成功')
        setCreateModalVisible(false)
        setSubFolderName('')
        onRefresh()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '创建子文件夹失败')
      }
    }
  )
  
  const deleteSubFolderMutation = useMutation(
    async (folderId) => {
      await api.delete(`/folders/${folderId}`)
    },
    {
      onSuccess: () => {
        message.success('子文件夹删除成功')
        onRefresh()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '删除子文件夹失败')
      }
    }
  )

  const handleCreateSubFolder = () => {
    if (!subFolderName.trim()) {
      message.error('请输入文件夹名称')
      return
    }
    
    createSubFolderMutation.mutate({
      alias: subFolderName,
      parentId: parseInt(folderId)
    })
  }

  const columns = [
    {
      title: '文件夹名称',
      dataIndex: 'alias',
      key: 'alias',
      ellipsis: true,
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => navigate(`/folder/${record.id}`)}
          style={{ padding: isMobile ? '0 4px' : '0 8px' }}
        >
          <FileOutlined /> {text}
        </Button>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: isMobile ? 120 : 180,
      render: (_, record) => (
        <Space direction={isMobile ? 'vertical' : 'horizontal'} size="small">
          <Button 
            type="link" 
            onClick={() => navigate(`/folder/${record.id}`)}
            size="small"
            block={isMobile}
          >
            打开
          </Button>
          <Popconfirm
            title="确定要删除这个子文件夹吗？"
            description="删除后将无法恢复，文件夹中的所有文件也会被删除。"
            onConfirm={() => deleteSubFolderMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger
              icon={<DeleteOutlined />}
              size="small"
              block={isMobile}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ 
          marginBottom: 16, 
          display: 'flex', 
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 0
        }}>
          <span>子文件夹</span>
          <Button 
            type="primary" 
            icon={<FileOutlined />}
            onClick={() => setCreateModalVisible(true)}
            block={isMobile}
            size={isMobile ? 'middle' : 'default'}
          >
            创建子文件夹
          </Button>
        </div>
        
        {subFolders.length > 0 ? (
          <Table
            dataSource={subFolders}
            rowKey="id"
            pagination={false}
            size="small"
            columns={columns}
            scroll={{ x: isMobile ? 400 : undefined }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无子文件夹
          </div>
        )}
      </Card>

      <Modal
        title="创建子文件夹"
        open={createModalVisible}
        onOk={handleCreateSubFolder}
        onCancel={() => {
          setCreateModalVisible(false)
          setSubFolderName('')
        }}
        confirmLoading={createSubFolderMutation.isLoading}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>文件夹名称:</Text>
          <Input 
            value={subFolderName}
            onChange={(e) => setSubFolderName(e.target.value)}
            placeholder="请输入子文件夹名称"
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </>
  )
}

export default SubFolderCard
