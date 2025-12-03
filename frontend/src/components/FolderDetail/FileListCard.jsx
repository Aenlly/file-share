import { useState } from 'react'
import { Card, Button, Table, Space, Popconfirm, Modal, message } from 'antd'
import { DeleteOutlined, EyeOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons'
import { useMutation } from 'react-query'
import dayjs from 'dayjs'
import api from '../../utils/api'

const FileListCard = ({ folderId, files, isLoading, onRefresh, isMobile = false, onPreview, onDownload, onMove }) => {
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
      ellipsis: true,
      width: isMobile ? 120 : undefined,
      render: (text, record) => {
        const displayName = record.name || text || '未知文件'
        
        return (
          <Space size="small">
            {displayName && isImageFile(displayName) ? (
              <FileOutlined style={{ color: '#52c41a', fontSize: isMobile ? 12 : 14 }} />
            ) : (
              <FileOutlined style={{ color: '#1890ff', fontSize: isMobile ? 12 : 14 }} />
            )}
            <span style={{ fontSize: isMobile ? 12 : 14 }}>{displayName}</span>
          </Space>
        )
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: isMobile ? 70 : 100,
      render: (size) => <span style={{ fontSize: isMobile ? 11 : 14 }}>{formatFileSize(size)}</span>
    },
    ...(!isMobile ? [{
      title: '修改时间',
      dataIndex: 'mtime',
      key: 'mtime',
      render: (mtime) => dayjs(mtime).format('YYYY-MM-DD HH:mm:ss')
    }] : []),
    {
      title: '操作',
      key: 'actions',
      fixed: isMobile ? 'right' : false,
      width: isMobile ? 100 : 280,
      render: (_, record) => {
        if (isMobile) {
          return (
            <Space direction="vertical" size="small">
              {record.name && isImageFile(record.name) && (
                <Button 
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => onPreview(record)}
                  block
                >
                  预览
                </Button>
              )}
              <Button 
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => onDownload(record)}
                block
              >
                下载
              </Button>
              <Button 
                size="small"
                onClick={() => onMove(record)}
                block
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
                  block
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          )
        }
        
        return (
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
    }
  ]

  return (
    <Card>
      <div style={{ 
        marginBottom: 16, 
        display: 'flex', 
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 12 : 0
      }}>
        <span>文件列表</span>
        {selectedRowKeys.length > 0 && (
          <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
            <span>已选择 {selectedRowKeys.length} 个文件</span>
            <Button 
              danger 
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
              block={isMobile}
              size={isMobile ? 'middle' : 'default'}
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
        pagination={{ 
          pageSize: isMobile ? 5 : 10,
          simple: isMobile
        }}
        scroll={{ x: isMobile ? 600 : undefined }}
        rowSelection={!isMobile ? {
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          getCheckboxProps: (record) => ({
            name: record.savedName,
          }),
        } : undefined}
      />
    </Card>
  )
}

export default FileListCard
