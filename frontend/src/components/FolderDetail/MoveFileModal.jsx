import { useState, useEffect } from 'react'
import { Modal, Input, Typography, message } from 'antd'
import { useMutation } from 'react-query'
import api from '../../utils/api'

const { Text } = Typography

const MoveFileModal = ({ visible, folderId, file, allFolders, onClose, onSuccess }) => {
  const [targetFolder, setTargetFolder] = useState('')

  useEffect(() => {
    if (!visible) {
      setTargetFolder('')
    }
  }, [visible])

  const moveFileMutation = useMutation(
    async ({ filename, targetFolderId }) => {
      await api.post(`/folders/${folderId}/move`, { filename, targetFolderId })
    },
    {
      onSuccess: () => {
        message.success('文件移动成功')
        onSuccess()
        onClose()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '移动文件失败')
      }
    }
  )

  const handleConfirm = () => {
    if (!targetFolder) {
      message.warning('请选择目标文件夹')
      return
    }

    moveFileMutation.mutate({
      filename: file.savedName,
      targetFolderId: targetFolder
    })
  }

  return (
    <Modal
      title="移动文件"
      open={visible}
      onOk={handleConfirm}
      onCancel={onClose}
      confirmLoading={moveFileMutation.isLoading}
    >
      <div style={{ marginBottom: 16 }}>
        <Text>选择文件: <strong>{file?.name}</strong></Text>
      </div>
      <div>
        <Text>目标文件夹:</Text>
        <Input
          style={{ marginTop: 8 }}
          type="number"
          placeholder="请输入目标文件夹ID"
          value={targetFolder}
          onChange={(e) => setTargetFolder(e.target.value)}
        />
        <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
          <div>可用文件夹:</div>
          {allFolders.filter(f => f.id !== parseInt(folderId)).length > 0 ? (
            <div>
              {allFolders.filter(f => f.id !== parseInt(folderId)).map(f => (
                <div key={f.id} style={{ cursor: 'pointer', padding: '4px 0' }} onClick={() => setTargetFolder(String(f.id))}>
                  {f.alias} (ID: {f.id})
                </div>
              ))}
            </div>
          ) : (
            <div>没有其他文件夹可用</div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default MoveFileModal
