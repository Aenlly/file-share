import { useState } from 'react'
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
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => navigate(`/folder/${record.id}`)}
        >
          <FileOutlined /> {text}
        </Button>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            onClick={() => navigate(`/folder/${record.id}`)}
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
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span>子文件夹</span>
          <Button 
            type="primary" 
            icon={<FileOutlined />}
            onClick={() => setCreateModalVisible(true)}
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
