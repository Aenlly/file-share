import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Space, Typography } from 'antd'
import { ArrowLeftOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useQuery } from 'react-query'
import api from '../utils/api'
import { useAuthStore } from '../stores/authStore'
import { useFileOperations } from '../hooks/useFileOperations'

// Import components
import FileUploadCard from '../components/FolderDetail/FileUploadCard'
import SubFolderCard from '../components/FolderDetail/SubFolderCard'
import FileListCard from '../components/FolderDetail/FileListCard'
import MoveFileModal from '../components/FolderDetail/MoveFileModal'
import ShareModal from '../components/FolderDetail/ShareModal'
import ImagePreviewModal from '../components/FolderDetail/ImagePreviewModal'

const { Title } = Typography

const FolderDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [isMobile, setIsMobile] = useState(false)
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [shareModalVisible, setShareModalVisible] = useState(false)
  
  const { previewImage, setPreviewImage, handlePreviewImage, handleDownloadFile } = useFileOperations(id)

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 获取文件夹信息
  const { data: folder, isLoading: folderLoading } = useQuery(
    ['folder', id],
    async () => {
      const response = await api.get(`/folders`)
      const folders = response.data
      return folders.find(f => f.id === parseInt(id))
    },
    {
      enabled: !!id
    }
  )

  // 获取父文件夹信息
  const { data: parentFolder } = useQuery(
    ['parentFolder', folder?.parentId],
    async () => {
      if (!folder?.parentId) return null
      const response = await api.get(`/folders`)
      const folders = response.data
      return folders.find(f => f.id === folder.parentId)
    },
    {
      enabled: !!folder?.parentId
    }
  )

  // 获取文件夹内容
  const { data: files = [], isLoading: filesLoading, refetch } = useQuery(
    ['folderFiles', id],
    async () => {
      const response = await api.get(`/folders/${id}/files`)
      return response.data
    },
    {
      enabled: !!id
    }
  )

  // 获取所有文件夹（用于移动文件）
  const { data: allFolders = [] } = useQuery(
    ['folders', user?.username || 'anonymous'],
    async () => {
      const response = await api.get('/folders')
      return response.data
    },
    {
      enabled: !!user
    }
  )

  // 获取子文件夹
  const { data: subFolders = [], refetch: refetchSubFolders } = useQuery(
    ['subFolders', id],
    async () => {
      const response = await api.get(`/folders/${id}/subfolders`)
      return response.data
    },
    {
      enabled: !!id
    }
  )

  const handleMoveFile = (file) => {
    setSelectedFile(file)
    setMoveModalVisible(true)
  }

  if (folderLoading) {
    return <div>加载中...</div>
  }

  if (!folder) {
    return <div>文件夹不存在</div>
  }

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
        <Space direction={isMobile ? 'vertical' : 'horizontal'}>
          <Button 
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              if (parentFolder) {
                navigate(`/folder/${parentFolder.id}`)
              } else {
                navigate('/dashboard')
              }
            }}
          >
            返回
          </Button>
          <Title level={2} style={{ margin: 0 }}>{folder.alias}</Title>
        </Space>
        <Button 
          type="primary"
          icon={<ShareAltOutlined />}
          onClick={() => setShareModalVisible(true)}
        >
          分享文件夹
        </Button>
      </div>

      <FileUploadCard 
        folderId={id} 
        onUploadSuccess={refetch}
        isMobile={isMobile}
      />

      <SubFolderCard 
        folderId={id}
        subFolders={subFolders}
        onRefresh={refetchSubFolders}
      />

      <FileListCard 
        folderId={id}
        files={files}
        isLoading={filesLoading}
        onRefresh={refetch}
        isMobile={isMobile}
        onPreview={handlePreviewImage}
        onDownload={handleDownloadFile}
        onMove={handleMoveFile}
      />

      <MoveFileModal
        visible={moveModalVisible}
        folderId={id}
        file={selectedFile}
        allFolders={allFolders}
        onClose={() => {
          setMoveModalVisible(false)
          setSelectedFile(null)
        }}
        onSuccess={refetch}
      />

      <ShareModal
        visible={shareModalVisible}
        folderId={id}
        onClose={() => setShareModalVisible(false)}
      />

      <ImagePreviewModal
        visible={previewImage.visible}
        image={previewImage}
        folderId={id}
        onClose={() => setPreviewImage({ visible: false, src: '', name: '' })}
      />
    </div>
  )
}

export default FolderDetail
