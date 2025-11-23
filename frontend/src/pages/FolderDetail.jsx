import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Card, 
  Button, 
  Table, 
  Upload, 
  message, 
  Space, 
  Popconfirm,
  Typography,
  Modal,
  Input,
  Progress,
  Switch
} from 'antd'
import { 
  UploadOutlined, 
  DeleteOutlined, 
  ArrowLeftOutlined,
  FileOutlined,
  InboxOutlined,
  ShareAltOutlined,
  EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import dayjs from 'dayjs'
import api from '../utils/api'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography
const { Dragger } = Upload

const FolderDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [fileList, setFileList] = useState([])
  const [uploading, setUploading] = useState(false)
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [targetFolder, setTargetFolder] = useState('')
  const [shareModalVisible, setShareModalVisible] = useState(false)
  const [shareCode, setShareCode] = useState('')
  const [shareExpiration, setShareExpiration] = useState(7) // 默认7天
  const [isSharing, setIsSharing] = useState(false)
  const [previewImage, setPreviewImage] = useState({ visible: false, src: '', name: '' })
  const [forceUpload, setForceUpload] = useState(false)
  const [useChunkUpload, setUseChunkUpload] = useState(false) // 是否使用分片上传
  const [uploadProgress, setUploadProgress] = useState({}) // 上传进度
  const [selectedRowKeys, setSelectedRowKeys] = useState([]) // 选中的文件
  const queryClient = useQueryClient()
  const [isMobile, setIsMobile] = useState(false)
  const [createSubFolderModalVisible, setCreateSubFolderModalVisible] = useState(false)
  const [subFolderName, setSubFolderName] = useState('')

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

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
  const { user } = useAuthStore()
  const { data: allFolders = [] } = useQuery(
    ['folders', user?.username || 'anonymous'], // 使用用户特定的查询键
    async () => {
      const response = await api.get('/folders')
      return response.data
    },
    {
      enabled: !!user // 只有用户登录时才执行查询
    }
  )

  // 获取子文件夹
  const { data: subFolders = [], isLoading: subFoldersLoading, refetch: refetchSubFolders } = useQuery(
    ['subFolders', id],
    async () => {
      const response = await api.get(`/folders/${id}/subfolders`)
      return response.data
    },
    {
      enabled: !!id
    }
  )

  // 创建子文件夹
  const createSubFolderMutation = useMutation(
    async (folderData) => {
      const response = await api.post('/folders', folderData)
      return response.data
    },
    {
      onSuccess: () => {
        message.success('子文件夹创建成功')
        setCreateSubFolderModalVisible(false)
        setSubFolderName('')
        refetchSubFolders()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '创建子文件夹失败')
      }
    }
  )
  
  // 删除子文件夹
  const deleteSubFolderMutation = useMutation(
    async (folderId) => {
      await api.delete(`/folders/${folderId}`)
    },
    {
      onSuccess: () => {
        message.success('子文件夹删除成功')
        refetchSubFolders()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '删除子文件夹失败')
      }
    }
  )
  
  // 移动文件
  const moveFileMutation = useMutation(
    async ({ filename, targetFolderId }) => {
      await api.post(`/folders/${id}/move`, { filename, targetFolderId })
    },
    {
      onSuccess: () => {
        message.success('文件移动成功')
        refetch()
        setMoveModalVisible(false)
        setSelectedFile(null)
        setTargetFolder('')
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '移动文件失败')
      }
    }
  )

  // 分片上传单个文件
  const uploadFileInChunks = async (file) => {
    const CHUNK_SIZE = 200 * 1024; // 200KB per chunk
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    try {
      // 确保文件名使用UTF-8编码
      let fileName = file.name;
      
      // 对于包含非ASCII字符的文件名，进行编码处理
      if (/[^\\x00-\\x7F]/.test(fileName)) {
        try {
          // 将文件名转换为UTF-8字节数组，然后再转换为Base64
          const encoder = new TextEncoder();
          const uint8Array = encoder.encode(fileName);
          // 将字节数组转换为Base64字符串
          fileName = btoa(String.fromCharCode.apply(null, uint8Array));
          // 添加标记，表示这是Base64编码的文件名
          fileName = 'UTF8:' + fileName;
        } catch (e) {
          console.error('文件名编码失败:', e);
          // 如果编码失败，使用原始文件名
        }
      }
      
      // 初始化分片上传
      const initResponse = await api.post(`/folders/${id}/chunk/init`, {
        fileName: fileName,
        fileSize: file.size
      });
      
      const { uploadId } = initResponse.data;
      
      // 更新进度
      setUploadProgress(prev => ({
        ...prev,
        [file.uid]: { 
          fileName: file.name, 
          progress: 0, 
          total: totalChunks,
          status: 'uploading'
        }
      }));
      
      // 上传所有分片
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        // 将分片转换为Base64
        const reader = new FileReader();
        const chunkBase64 = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result.split(',')[1]);
          reader.readAsDataURL(chunk);
        });
        
        // 上传分片
        await api.post(`/folders/${id}/chunk`, {
          uploadId,
          chunkIndex,
          chunk: chunkBase64
        });
        
        // 更新进度
        setUploadProgress(prev => ({
          ...prev,
          [file.uid]: { 
            ...prev[file.uid], 
            progress: chunkIndex + 1,
            status: chunkIndex + 1 === totalChunks ? 'completed' : 'uploading'
          }
        }));
      }
      
      // 完成分片上传
      await api.post(`/folders/${id}/chunk/complete`, {
        uploadId
      });
      
      return { success: true, fileName: file.name };
    } catch (error) {
      console.error('分片上传失败:', error);
      setUploadProgress(prev => ({
        ...prev,
        [file.uid]: { 
          ...prev[file.uid], 
          status: 'error',
          error: error.message
        }
      }));
      return { success: false, fileName: file.name, error: error.message };
    }
  };
  
  // 上传文件
  const uploadMutation = useMutation(
    async (formData) => {
      const response = await api.post(`/folders/${id}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      return response.data
    },
    {
      onSuccess: (data) => {
        // 处理多文件上传的结果
        const { uploadedFiles, existingFiles, errorFiles, total } = data
        
        if (uploadedFiles.length > 0) {
          message.success(`成功上传 ${uploadedFiles.length} 个文件`)
        }
        
        if (existingFiles.length > 0) {
          Modal.confirm({
            title: '文件已存在',
            content: `${existingFiles.map(f => f.filename).join(', ')} 已存在，是否覆盖？`,
            okText: '覆盖',
            cancelText: '取消',
            onOk: () => {
              // 设置强制上传标志并重新上传
              setForceUpload(true)
            }
          })
          return // 不清空文件列表，等待用户确认
        }
        
        if (errorFiles.length > 0) {
          message.error(`${errorFiles.length} 个文件上传失败`)
        }
        
        // 如果有文件成功上传，刷新文件列表并清空上传队列
        if (uploadedFiles.length > 0) {
          setFileList([])
          refetch()
        }
      },
      onError: (error) => {
        const errorData = error.response?.data
        
        if (error.response?.status === 409) {
          // 文件已存在的错误
          Modal.confirm({
            title: '文件已存在',
            content: `${errorData.existingFiles?.map(f => f.filename).join(', ')} 已存在，是否覆盖？`,
            okText: '覆盖',
            cancelText: '取消',
            onOk: () => {
              // 设置强制上传标志并重新上传
              setForceUpload(true)
            }
          })
        } else {
          message.error(errorData?.error || '文件上传失败')
        }
      }
    }
  )

  // 删除文件（支持单个或批量删除）
  const deleteFileMutation = useMutation(
    async (files) => {
      // 支持单个文件或文件数组
      const fileArray = Array.isArray(files) ? files : [files];
      // 使用savedName作为删除参数，因为这是服务器上的实际文件名
      const filenames = fileArray.map(f => f.savedName);
      
      const response = await api.delete(`/folders/${id}/file`, { 
        data: { filenames } 
      });
      
      return response.data;
    },
    {
      onSuccess: (data) => {
        const { deletedFiles, errorFiles, total } = data;
        
        if (deletedFiles.length > 0) {
          message.success(`成功删除 ${deletedFiles.length} 个文件`);
        }
        
        if (errorFiles.length > 0) {
          message.error(`${errorFiles.length} 个文件删除失败`);
        }
        
        // 清空选中项
        setSelectedRowKeys([]);
        refetch();
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '文件删除失败');
      }
    }
  )

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的文件')
      return
    }

    setUploading(true)
    
    try {
      if (useChunkUpload) {
        // 使用分片上传
        const results = []
        
        for (const file of fileList) {
          const result = await uploadFileInChunks(file)
          results.push(result)
        }
        
        // 处理结果
        const successCount = results.filter(r => r.success).length
        const errorCount = results.length - successCount
        
        if (successCount > 0) {
          message.success(`成功上传 ${successCount} 个文件`)
        }
        
        if (errorCount > 0) {
          message.error(`${errorCount} 个文件上传失败`)
        }
        
        // 如果有文件成功上传，刷新文件列表并清空上传队列
        if (successCount > 0) {
          setFileList([])
          setUploadProgress({})
          refetch()
        }
      } else {
        // 使用普通上传
        const formData = new FormData()
        
        // 添加所有选中的文件
        fileList.forEach(file => {
          let fileName = file.name;
          
          // 对于包含非ASCII字符的文件名，进行编码处理
          if (/[^\\x00-\\x7F]/.test(fileName)) {
            try {
              // 将文件名转换为UTF-8字节数组，然后再转换为Base64
              const encoder = new TextEncoder();
              const uint8Array = encoder.encode(fileName);
              // 将字节数组转换为Base64字符串
              const base64Name = btoa(String.fromCharCode.apply(null, uint8Array));
              // 添加标记，表示这是Base64编码的文件名
              fileName = 'UTF8:' + base64Name;
            } catch (e) {
              console.error('文件名编码失败:', e);
              // 如果编码失败，使用原始文件名
            }
          }
          
          // 创建一个新的File对象，使用处理后的文件名
          const correctedFile = new File([file], fileName, {
            type: file.type,
            lastModified: file.lastModified
          });
          formData.append('files', correctedFile)
        })
        
        // 如果有强制上传选项，添加到表单数据
        if (forceUpload) {
          formData.append('force', 'true')
        }
        
        await uploadMutation.mutateAsync(formData)
        
        // 如果有文件成功上传，刷新文件列表并清空上传队列
        setFileList([])
        refetch()
      }
    } catch (error) {
      console.error('上传失败:', error)
    } finally {
      setUploading(false)
      setForceUpload(false) // 重置强制上传状态
    }
  }

  const handleDeleteFile = (file) => {
    deleteFileMutation.mutate(file)
  }

  // 创建子文件夹
  const handleCreateSubFolder = () => {
    if (!subFolderName.trim()) {
      message.error('请输入文件夹名称')
      return
    }
    
    createSubFolderMutation.mutate({
      alias: subFolderName,
      parentId: parseInt(id)
    })
  }
  
  // 删除子文件夹
  const handleDeleteSubFolder = (folderId) => {
    deleteSubFolderMutation.mutate(folderId)
  }
  
  // 批量删除文件
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的文件');
      return;
    }
    
    Modal.confirm({
      title: '批量删除确认',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个文件吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        // 获取选中的文件对象
        const selectedFiles = files.filter(file => 
          selectedRowKeys.includes(file.id)
        );
        deleteFileMutation.mutate(selectedFiles);
      }
    });
  }

  const handleMoveFile = (file) => {
    setSelectedFile(file)
    setMoveModalVisible(true)
  }

  const handlePreviewImage = async (file) => {
    // 使用savedName作为预览参数，因为这是服务器上的实际文件名
    let savedName = file.savedName;
    let displayName = file.name; // 显示名称仍然是原始文件名
    
    // 添加调试信息
    console.log('预览文件信息:', {
      id: file.id,
      name: file.name,
      savedName: file.savedName,
      isImage: isImageFile(file.name)
    });
    
    // 先打开模态框显示加载状态
    setPreviewImage({
      visible: true,
      src: `/api/folders/${id}/preview/${encodeURIComponent(savedName)}?width=800&height=600`,
      name: displayName,
      loading: true
    });
    
    try {
      // 获取认证信息
      const authData = localStorage.getItem('auth-storage');
      let headers = {};
      
      if (authData) {
        try {
          const { state } = JSON.parse(authData);
          if (state.token) {
            headers.Authorization = `Bearer ${state.token}`;
          }
        } catch (error) {
          console.error('解析认证数据失败', error);
        }
      }
      
      // 使用完整的URL获取图片，绕过Vite代理
      const previewUrl = `http://localhost:3000/api/folders/${id}/preview/${encodeURIComponent(savedName)}?width=800&height=600`;
      console.log('预览URL:', previewUrl);
      
      const response = await fetch(previewUrl, {
        headers
      });
      
      if (!response.ok) {
        // 如果使用savedName失败，尝试使用原始文件名
        if (response.status === 400 || response.status === 404) {
          console.log('使用savedName失败，尝试使用原始文件名');
          const fallbackUrl = `http://localhost:3000/api/folders/${id}/preview/${encodeURIComponent(displayName)}?width=800&height=600`;
          console.log('备用预览URL:', fallbackUrl);
          
          const fallbackResponse = await fetch(fallbackUrl, {
            headers
          });
          
          if (!fallbackResponse.ok) {
            // 尝试获取错误详情
            const errorText = await fallbackResponse.text();
            console.error('备用预览也失败，错误详情:', errorText);
            
            // 尝试使用文件ID查找
            console.log('尝试使用文件ID查找');
            const idFallbackUrl = `http://localhost:3000/api/folders/${id}/preview/by-id/${file.id}?width=800&height=600`;
            console.log('ID预览URL:', idFallbackUrl);
            
            try {
              const idFallbackResponse = await fetch(idFallbackUrl, {
                headers
              });
              
              if (idFallbackResponse.ok) {
                // 将响应转换为blob
                const blob = await idFallbackResponse.blob();
                
                // 创建blob URL
                const blobUrl = URL.createObjectURL(blob);
                
                // 更新预览状态，使用blob URL
                setPreviewImage(prev => ({
                  ...prev,
                  blobUrl: blobUrl,
                  loading: false
                }));
                return;
              }
            } catch (idError) {
              console.error('ID预览也失败:', idError);
            }
            
            throw new Error(`HTTP error! status: ${fallbackResponse.status}, details: ${errorText}`);
          }
          
          // 将响应转换为blob
          const blob = await fallbackResponse.blob();
          
          // 创建blob URL
          const blobUrl = URL.createObjectURL(blob);
          
          // 更新预览状态，使用blob URL
          setPreviewImage(prev => ({
            ...prev,
            blobUrl: blobUrl,
            loading: false
          }));
          return;
        }
        
        // 尝试获取错误详情
        const errorText = await response.text();
        console.error('预览失败，错误详情:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }
      
      // 将响应转换为blob
      const blob = await response.blob();
      
      // 创建blob URL
      const blobUrl = URL.createObjectURL(blob);
      
      // 更新预览状态，使用blob URL
      setPreviewImage(prev => ({
        ...prev,
        blobUrl: blobUrl,
        loading: false
      }));
    } catch (error) {
      console.error('获取图片预览失败:', error);
      message.error('获取图片预览失败');
      
      // 关闭预览模态框
      setPreviewImage({ visible: false, src: '', name: '' });
    }
  }

  const handleDownloadFile = (file) => {
    // 使用显示名称作为下载参数
    const displayName = file.name;
    
    // 创建下载链接
    const downloadUrl = `/api/folders/${id}/download/${displayName}`
    
    // 创建临时链接并触发下载
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = displayName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const confirmMoveFile = () => {
    if (!targetFolder) {
      message.warning('请选择目标文件夹')
      return
    }

    // 调用移动文件的API
    moveFileMutation.mutate({
      filename: selectedFile.savedName,
      targetFolderId: targetFolder
    })
  }

  // 生成分享链接
  const handleGenerateShare = async () => {
    setIsSharing(true)
    try {
      // 计算过期时间的毫秒数
      const expireInMs = shareExpiration * 24 * 60 * 60 * 1000 // 天数转换为毫秒
      const response = await api.post('/shares', {
        folderId: parseInt(id),
        expireInMs
      })
      
      setShareCode(response.data.code)
      
      // 自动复制分享链接到剪贴板
      const shareUrl = `${window.location.origin}/guest`
      const accessCode = response.data.code
      const shareText = `${shareUrl}?code=${accessCode}`
      
      navigator.clipboard.writeText(shareText)
        .then(() => message.success('分享链接生成成功并已复制到剪贴板'))
        .catch(() => message.success('分享链接生成成功，但复制失败'))
    } catch (error) {
      message.error('生成分享链接失败')
      console.error('生成分享链接失败:', error)
    } finally {
      setIsSharing(false)
    }
  }

  // 复制分享链接
  const copyShareLink = () => {
    if (!shareCode) return
    
    const shareUrl = `${window.location.origin}/guest`
    const accessCode = shareCode
    
    // 复制可以直接在浏览器中访问的完整链接
    const shareText = `${shareUrl}?code=${accessCode}`
    
    navigator.clipboard.writeText(shareText)
      .then(() => message.success('分享链接已复制到剪贴板'))
      .catch(() => message.error('复制失败'))
  }

  const uploadProps = {
    onRemove: (file) => {
      const newFileList = fileList.filter(item => item.uid !== file.uid)
      setFileList(newFileList)
    },
    beforeUpload: (file, fileList) => {
      // 支持多文件上传
      // fileList 参数包含了所有选中的文件
      setFileList(fileList)
      return false // 阻止自动上传
    },
    fileList,
    multiple: true, // 启用多文件选择
  }

  // 判断是否为图片文件
  const isImageFile = (filename) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return imageExtensions.includes(ext);
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        // 使用显示名称作为预览和下载的参数
        const displayName = record.name || text;
        
        return (
          <Space>
            {isImageFile(displayName) ? (
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
          {isImageFile(record.name) && (
            <Button 
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreviewImage(record)}
            >
              预览
            </Button>
          )}
          <Button 
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadFile(record)}
          >
            下载
          </Button>
          <Button 
            size="small"
            onClick={() => handleMoveFile(record)}
          >
            移动
          </Button>
          <Popconfirm
            title="确定要删除这个文件吗?"
            onConfirm={() => handleDeleteFile(record)}
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
              // 如果有父文件夹，返回到父文件夹；否则返回到Dashboard
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

      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>上传选项:</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: 8 }}>使用分片上传 (适用于大文件):</span>
            <Switch 
              checked={useChunkUpload} 
              onChange={setUseChunkUpload} 
            />
          </div>
        </div>
        
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持单个或批量文件上传 (最多200个文件)</p>
        </Dragger>
        
        {/* 显示上传进度 */}
        {Object.keys(uploadProgress).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4>上传进度:</h4>
            {Object.entries(uploadProgress).map(([fileId, progress]) => (
              <div key={fileId} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{progress.fileName}</span>
                  <span>{progress.progress}/{progress.total}</span>
                </div>
                <Progress 
                  percent={Math.round((progress.progress / progress.total) * 100)} 
                  status={progress.status === 'error' ? 'exception' : progress.status === 'completed' ? 'success' : 'active'}
                  size="small"
                />
              </div>
            ))}
          </div>
        )}
        
        {fileList.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button 
              type="primary" 
              icon={<UploadOutlined />}
              onClick={handleUpload}
              loading={uploading}
              block={isMobile}
            >
              {uploading ? '上传中...' : '开始上传'}
            </Button>
          </div>
        )}
      </Card>

      {/* 子文件夹列表 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span>子文件夹</span>
          <Button 
            type="primary" 
            icon={<FileOutlined />}
            onClick={() => setCreateSubFolderModalVisible(true)}
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
            columns={[
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
                      onConfirm={() => handleDeleteSubFolder(record.id)}
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
            ]}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无子文件夹
          </div>
        )}
      </Card>

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
          loading={filesLoading}
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

      <Modal
        title="移动文件"
        open={moveModalVisible}
        onOk={confirmMoveFile}
        onCancel={() => {
          setMoveModalVisible(false)
          setSelectedFile(null)
          setTargetFolder('')
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>选择文件: <strong>{selectedFile?.name}</strong></Text>
        </div>
        <div>
          <Text>目标文件夹:</Text>
          <Input
            style={{ marginTop: 8 }}
            placeholder="请输入目标文件夹ID"
            value={targetFolder}
            onChange={(e) => setTargetFolder(e.target.value)}
          />
          <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
            可用文件夹: {allFolders.filter(f => f.id !== parseInt(id)).map(f => `${f.alias}(${f.id})`).join(', ')}
          </div>
        </div>
      </Modal>

      {/* 分享模态框 */}
      <Modal
        title="分享文件夹"
        open={shareModalVisible}
        onCancel={() => {
          setShareModalVisible(false)
          setShareCode('')
          setShareExpiration(7)
        }}
        footer={shareCode ? [
          <Button key="copy" type="primary" onClick={copyShareLink}>
            复制链接
          </Button>,
          <Button key="close" onClick={() => {
            setShareModalVisible(false)
            setShareCode('')
            setShareExpiration(7)
          }}>
            关闭
          </Button>
        ] : [
          <Button key="cancel" onClick={() => {
            setShareModalVisible(false)
            setShareCode('')
            setShareExpiration(7)
          }}>
            取消
          </Button>,
          <Button 
            key="generate" 
            type="primary" 
            onClick={handleGenerateShare}
            loading={isSharing}
          >
            生成分享链接
          </Button>
        ]}
      >
        {!shareCode ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text>设置分享链接有效期:</Text>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Button.Group>
                <Button 
                  type={shareExpiration === 1 ? 'primary' : 'default'}
                  onClick={() => setShareExpiration(1)}
                >
                  1天
                </Button>
                <Button 
                  type={shareExpiration === 7 ? 'primary' : 'default'}
                  onClick={() => setShareExpiration(7)}
                >
                  7天
                </Button>
                <Button 
                  type={shareExpiration === 30 ? 'primary' : 'default'}
                  onClick={() => setShareExpiration(30)}
                >
                  30天
                </Button>
              </Button.Group>
            </div>
            <div>
              <Text type="secondary">
                分享链接将在 {dayjs().add(shareExpiration, 'day').format('YYYY-MM-DD HH:mm:ss')} 过期
              </Text>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>分享链接已生成!</Text>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text>访问码:</Text>
              <Input 
                value={shareCode} 
                readOnly 
                style={{ marginTop: 8, fontFamily: 'monospace' }}
              />
            </div>
            <div>
              <Text type="secondary">
                链接有效期至: {dayjs().add(shareExpiration, 'day').format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </div>
          </div>
        )}
      </Modal>

      {/* 图片预览模态框 */}
      <Modal
        title={previewImage.name}
        open={previewImage.visible}
        onCancel={() => {
          setPreviewImage({ visible: false, src: '', name: '' })
          // 清理blob URL
          if (previewImage.blobUrl) {
            URL.revokeObjectURL(previewImage.blobUrl)
          }
        }}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => {
            // 下载原图
            const link = document.createElement('a')
            link.href = previewImage.src.replace(/width=\d+&height=\d+/, 'width=1920&height=1080')
            link.download = previewImage.name
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }}>
            下载原图
          </Button>,
          <Button key="close" onClick={() => {
            setPreviewImage({ visible: false, src: '', name: '' })
            // 清理blob URL
            if (previewImage.blobUrl) {
              URL.revokeObjectURL(previewImage.blobUrl)
            }
          }}>
            关闭
          </Button>
        ]}
        width="80%"
        style={{ top: 20 }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          maxHeight: '70vh',
          overflow: 'hidden'
        }}>
          {previewImage.loading ? (
            <div>加载中...</div>
          ) : (
            <img 
              src={previewImage.blobUrl || previewImage.src} 
              alt={previewImage.name}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          )}
        </div>
      </Modal>

      {/* 创建子文件夹模态框 */}
      <Modal
        title="创建子文件夹"
        open={createSubFolderModalVisible}
        onOk={handleCreateSubFolder}
        onCancel={() => {
          setCreateSubFolderModalVisible(false)
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
    </div>
  )
}

export default FolderDetail