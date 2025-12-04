# 用户存储配额前端实现指南

## 后端 API 已完成 ✅

所有后端 API 已经实现并可以直接使用：

1. **GET** `/api/users/storage/:username` - 获取用户存储信息
2. **PUT** `/api/users/:id/storage-quota` - 更新存储配额（管理员）
3. **POST** `/api/users/storage/:username/recalculate` - 重新计算存储

## 前端实现步骤

### 在 `frontend/src/pages/UserManagement.jsx` 中添加以下代码：

#### 1. 在文件顶部添加导入
```jsx
import { DatabaseOutlined } from '@ant-design/icons'
import { Progress, InputNumber, Alert } from 'antd'
```

#### 2. 在组件中添加状态
```jsx
const [isQuotaModalVisible, setIsQuotaModalVisible] = useState(false)
const [editingQuotaUser, setEditingQuotaUser] = useState(null)
const [quotaForm] = Form.useForm()
```

#### 3. 添加更新配额的 mutation
```jsx
const updateQuotaMutation = useMutation(
  async ({ id, storageQuota }) => {
    const response = await api.put(`/users/${id}/storage-quota`, {
      storageQuota: `${storageQuota}GB`
    })
    return response.data
  },
  {
    onSuccess: () => {
      message.success('存储配额更新成功')
      setIsQuotaModalVisible(false)
      quotaForm.resetFields()
      queryClient.invalidateQueries('users')
    },
    onError: (error) => {
      message.error(error.response?.data?.error || '更新配额失败')
    }
  }
)
```

#### 4. 添加处理函数
```jsx
const handleEditQuota = (user) => {
  setEditingQuotaUser(user)
  const quotaGB = ((user.storageQuota || 10737418240) / (1024 * 1024 * 1024)).toFixed(0)
  quotaForm.setFieldsValue({ storageQuota: parseInt(quotaGB) })
  setIsQuotaModalVisible(true)
}

const handleQuotaSubmit = async () => {
  try {
    const values = await quotaForm.validateFields()
    updateQuotaMutation.mutate({
      id: editingQuotaUser.id,
      storageQuota: values.storageQuota
    })
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}
```

#### 5. 在表格列定义中添加存储配额列

找到 `columns` 数组，在操作列之前添加：

```jsx
{
  title: '存储配额',
  dataIndex: 'storageQuota',
  key: 'storageQuota',
  render: (quota) => {
    const gb = ((quota || 10737418240) / (1024 * 1024 * 1024)).toFixed(2)
    return `${gb} GB`
  }
},
{
  title: '已使用',
  dataIndex: 'storageUsed',
  key: 'storageUsed',
  render: (used, record) => {
    const usedGb = ((used || 0) / (1024 * 1024 * 1024)).toFixed(2)
    const quota = record.storageQuota || 10737418240
    const percentage = ((used || 0) / quota * 100).toFixed(1)
    return (
      <div>
        <div>{usedGb} GB</div>
        <Progress 
          percent={parseFloat(percentage)} 
          size="small"
          status={percentage > 90 ? 'exception' : percentage > 80 ? 'warning' : 'normal'}
        />
      </div>
    )
  }
}
```

#### 6. 在操作列添加配额按钮

在操作列的 `render` 函数中添加：

```jsx
{
  title: '操作',
  key: 'action',
  render: (_, record) => (
    <Space>
      {/* 现有按钮... */}
      
      {currentUser.role === 'admin' && (
        <Button 
          icon={<DatabaseOutlined />}
          onClick={() => handleEditQuota(record)}
          size="small"
        >
          配额
        </Button>
      )}
    </Space>
  )
}
```

#### 7. 在 return 语句末尾添加配额模态框

```jsx
return (
  <div>
    {/* 现有内容... */}
    
    {/* 配额编辑模态框 */}
    <Modal
      title="设置存储配额"
      open={isQuotaModalVisible}
      onOk={handleQuotaSubmit}
      onCancel={() => {
        setIsQuotaModalVisible(false)
        quotaForm.resetFields()
      }}
      confirmLoading={updateQuotaMutation.isLoading}
    >
      <Form form={quotaForm} layout="vertical">
        <Form.Item
          label="存储配额 (GB)"
          name="storageQuota"
          rules={[
            { required: true, message: '请输入存储配额' },
            { 
              type: 'number', 
              min: 1, 
              max: 1000, 
              message: '配额必须在 1-1000 GB 之间'
            }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            max={1000}
            placeholder="请输入存储配额（GB）"
          />
        </Form.Item>
        
        {editingQuotaUser && (
          <Alert
            message="当前使用情况"
            description={
              <div>
                <p>已使用: {((editingQuotaUser.storageUsed || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
                <p>当前配额: {((editingQuotaUser.storageQuota || 10737418240) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
              </div>
            }
            type="info"
            showIcon
          />
        )}
      </Form>
    </Modal>
  </div>
)
```

## 完整的修改位置

1. **导入部分**（文件顶部）
2. **状态声明**（组件开始处）
3. **mutation 定义**（其他 mutation 之后）
4. **处理函数**（其他处理函数之后）
5. **表格列**（columns 数组中）
6. **模态框**（return 语句中）

## 测试步骤

1. 启动前端：`cd frontend && npm run dev`
2. 登录管理员账号
3. 进入用户管理页面
4. 应该看到每个用户的存储配额和使用情况
5. 点击"配额"按钮
6. 修改配额值
7. 点击确定
8. 查看是否更新成功

## 效果预览

用户管理表格将显示：
- 用户名
- 角色
- **存储配额**（如：10.00 GB）
- **已使用**（如：5.00 GB + 进度条）
- 操作按钮（包括新的"配额"按钮）

点击"配额"按钮后弹出模态框，可以输入新的配额值（1-1000 GB）。

## 注意事项

1. 只有管理员可以看到和修改配额
2. 配额单位是 GB
3. 已使用存储包括文件夹和回收站
4. 修改配额后立即生效
5. 上传文件时会自动检查配额

## 如果遇到问题

1. 检查后端是否启动：`http://localhost:3000/health`
2. 检查 API 是否可用：`GET http://localhost:3000/api/users`
3. 查看浏览器控制台错误
4. 查看后端日志

---

**所有后端功能已完成，只需按照上述步骤修改前端即可！**
