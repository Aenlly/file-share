import { useState } from 'react'
import { Card, Button, Table, Space, Popconfirm, Modal, message } from 'antd'
import { DeleteOutlined, EyeOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons'
import { useMutation } from 'react-query'
import dayjs from 'dayjs'
import api from '../../utils/api'

const FileListCard = ({ folderId, files, isLoading, onRefresh, isMobile, onPreview, onDownload, onMove }) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([])

  const deleteFileMutation = useMutation(
    async (files) => {
      const fileArray = Array.isArray(files) ? files : [files]
      const filenames = fileArray.map(f => f.savedName)
      
      const response = await api.delete(`/folders/${folderId}/file`, { 
        data: { filenames } 
      })
      
      return response.data
    },
    {
      onSuccess: (data) => {
        const { deletedFiles, errorFiles } = data
        
        if (deletedFiles.length > 0) {
          message.success(`成功删除 ${deletedFiles.length} 个文件`)
        }
        
        if (errorFiles.length > 0) {
          message.error(`${errorFiles.length} 个文件删除失败`)
        }
        
        setSelectedRowKeys([])
        onRefresh()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '文件删除失败')
      }
    }
  )

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的文件')
      return
    }
    
    Modal.confirm({
      title: '批量删除确认',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个文件吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        const selectedFiles = files.filter(file => 
          selectedRowKeys.includes(file.id)
        )
        deleteFileMutation.mutate(selectedFiles)
      }
    })
  }

  const isImageFile = (filename) => {
    if (!filename || typeof filename !== 'string') return false
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    const lastDotIndex = filename.lastIndexOf('.')
    if (lastDotIndex === -1) return false
    const ext = filename.substring(lastDotIndex).toLowerCase()
    return imageExtensions.includes(ext)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const displayName = record.name || text || '未知文件'
        
        return (
          <Space>
            {displayName && isImageFile(displayName) ? (
              <FileOutlined style={{ color: '#52c41a' }} />
            ) : (
              <FileOutlined style={{ color: '#1890ff' }} />
            )}
            <span>{displayName}</span>
          </Space>
        )
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size) => formatFileSize(size)
    },
    {
      title: '修改时间',
      dataIndex: 'mtime',
      key: 'mtime',
      render: (mtime) => dayjs(mtime).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.name && isImageFile(record.name) && (
            <Button 
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onPreview(record)}
            >
              预览
            </Button>
          )}
          <Button 
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => onDownload(record)}
          >
            下载
          </Button>
          <Button 
            size="small"
            onClick={() => onMove(record)}
          >
            移动
          </Button>
          <Popconfirm
            title="确定要删除这个文件吗?"
            onConfirm={() => deleteFileMutation.mutate(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              danger 
              size="small"
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
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span>文件列表</span>
        {selectedRowKeys.length > 0 && (
          <Space>
            <span>已选择 {selectedRowKeys.length} 个文件</span>
            <Button 
              danger 
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
            >
              批量删除
            </Button>
          </Space>
        )}
      </div>
      <Table 
        columns={columns} 
        dataSource={files} 
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: isMobile ? 800 : undefined }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          getCheckboxProps: (record) => ({
            name: record.savedName,
          }),
        }}
      />
    </Card>
  )
}

export default FileListCard
