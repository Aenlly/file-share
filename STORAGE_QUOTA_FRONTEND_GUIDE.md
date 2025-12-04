# 前端存储配额集成指南

**版本**: v2.0.2  
**日期**: 2024-12-04

---

## 后端 API 已就绪

### 1. 获取用户存储信息
```http
GET /api/users/storage/:username
Authorization: Bearer {token}
```

**响应示例**:
```json
{
  "username": "admin",
  "storageQuota": 10737418240,
  "storageUsed": 5368709120,
  "storageAvailable": 5368709120,
  "folderStorage": 4294967296,
  "recycleBinStorage": 1073741824,
  "fileCount": 150,
  "recycleBinCount": 20,
  "formatted": {
    "quota": "10.00 GB",
    "used": "5.00 GB",
    "available": "5.00 GB",
    "folderStorage": "4.00 GB",
    "recycleBinStorage": "1.00 GB"
  }
}
```

### 2. 更新存储配额（管理员）
```http
PUT /api/users/:id/storage-quota
Authorization: Bearer {token}
Content-Type: application/json

{
  "storageQuota": "20GB"  // 或数字: 21474836480
}
```

### 3. 重新计算存储（管理员）
```http
POST /api/users/storage/:username/recalculate
Authorization: Bearer {token}
```

---

## 前端集成步骤

### 步骤 1: 在用户管理页面添加存储配额列

**文件**: `frontend/src/pages/UserManagement.jsx`

在表格列定义中添加：

```jsx
const columns = [
  // ... 现有列
  {
    title: '存储配额',
    dataIndex: 'storageQuota',
    key: 'storageQuota',
    render: (quota) => {
      const gb = (quota / (1024 * 1024 * 1024)).toFixed(2);
      return `${gb} GB`;
    }
  },
  {
    title: '已使用',
    dataIndex: 'storageUsed',
    key: 'storageUsed',
    render: (used, record) => {
      const usedGb = ((used || 0) / (1024 * 1024 * 1024)).toFixed(2);
      const quota = record.storageQuota || 10737418240;
      const percentage = ((used || 0) / quota * 100).toFixed(1);
      return (
        <div>
          <div>{usedGb} GB</div>
          <Progress percent={parseFloat(percentage)} size="small" />
        </div>
      );
    }
  },
  {
    title: '操作',
    key: 'action',
    render: (_, record) => (
      <Space>
        {/* ... 现有操作按钮 */}
        <Button 
          icon={<DatabaseOutlined />}
          onClick={() => handleEditQuota(record)}
        >
          配额
        </Button>
      </Space>
    )
  }
];
```

### 步骤 2: 添加配额编辑模态框

```jsx
const [isQuotaModalVisible, setIsQuotaModalVisible] = useState(false);
const [editingQuotaUser, setEditingQuotaUser] = useState(null);
const [quotaForm] = Form.useForm();

const handleEditQuota = (user) => {
  setEditingQuotaUser(user);
  const quotaGB = (user.storageQuota / (1024 * 1024 * 1024)).toFixed(0);
  quotaForm.setFieldsValue({ storageQuota: quotaGB });
  setIsQuotaModalVisible(true);
};

// 更新配额 mutation
const updateQuotaMutation = useMutation(
  async ({ id, storageQuota }) => {
    const response = await api.put(`/users/${id}/storage-quota`, {
      storageQuota: `${storageQuota}GB`
    });
    return response.data;
  },
  {
    onSuccess: () => {
      message.success('存储配额更新成功');
      setIsQuotaModalVisible(false);
      quotaForm.resetFields();
      queryClient.invalidateQueries('users');
    },
    onError: (error) => {
      message.error(error.response?.data?.error || '更新配额失败');
    }
  }
);

const handleQuotaSubmit = async () => {
  try {
    const values = await quotaForm.validateFields();
    updateQuotaMutation.mutate({
      id: editingQuotaUser.id,
      storageQuota: values.storageQuota
    });
  } catch (error) {
    console.error('表单验证失败:', error);
  }
};
```

### 步骤 3: 添加配额模态框 JSX

```jsx
<Modal
  title="设置存储配额"
  open={isQuotaModalVisible}
  onOk={handleQuotaSubmit}
  onCancel={() => {
    setIsQuotaModalVisible(false);
    quotaForm.resetFields();
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
          message: '配额必须在 1-1000 GB 之间',
          transform: (value) => Number(value)
        }
      ]}
    >
      <InputNumber
        style={{ width: '100%' }}
        min={1}
        max={1000}
        placeholder="请输入存储配额（GB）"
        addonAfter="GB"
      />
    </Form.Item>
    
    {editingQuotaUser && (
      <Alert
        message="当前使用情况"
        description={
          <div>
            <p>已使用: {((editingQuotaUser.storageUsed || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
            <p>文件数: {editingQuotaUser.fileCount || 0}</p>
          </div>
        }
        type="info"
        showIcon
      />
    )}
  </Form>
</Modal>
```

### 步骤 4: 在仪表盘显示存储信息

**文件**: `frontend/src/pages/Dashboard.jsx`

```jsx
// 获取当前用户存储信息
const { data: storageInfo } = useQuery(
  ['userStorage', currentUser.username],
  async () => {
    const response = await api.get(`/users/storage/${currentUser.username}`);
    return response.data;
  },
  {
    enabled: !!currentUser,
    refetchInterval: 60000 // 每分钟刷新一次
  }
);

// 在仪表盘添加存储卡片
<Card title="存储空间" style={{ marginBottom: 16 }}>
  {storageInfo && (
    <>
      <Progress
        percent={((storageInfo.storageUsed / storageInfo.storageQuota) * 100).toFixed(1)}
        status={
          (storageInfo.storageUsed / storageInfo.storageQuota) > 0.9 
            ? 'exception' 
            : (storageInfo.storageUsed / storageInfo.storageQuota) > 0.8 
              ? 'warning' 
              : 'normal'
        }
      />
      <div style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title="已使用"
              value={storageInfo.formatted.used}
              prefix={<DatabaseOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="可用空间"
              value={storageInfo.formatted.available}
              prefix={<CloudOutlined />}
            />
          </Col>
        </Row>
        <Divider />
        <Row gutter={16}>
          <Col span={12}>
            <Text type="secondary">文件夹: {storageInfo.formatted.folderStorage}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary">回收站: {storageInfo.formatted.recycleBinStorage}</Text>
          </Col>
        </Row>
      </div>
    </>
  )}
</Card>
```

### 步骤 5: 上传时显示配额警告

**文件**: `frontend/src/components/FolderDetail/FileUploadCard.jsx`

```jsx
// 在上传前检查
const beforeUpload = async (file) => {
  try {
    // 获取存储信息
    const response = await api.get(`/users/storage/${currentUser.username}`);
    const storageInfo = response.data;
    
    // 检查是否超配额
    if (storageInfo.storageUsed + file.size > storageInfo.storageQuota) {
      message.error(
        `存储空间不足！需要 ${(file.size / (1024 * 1024)).toFixed(2)} MB，` +
        `可用 ${storageInfo.formatted.available}`
      );
      return Upload.LIST_IGNORE;
    }
    
    // 警告（使用超过80%）
    if ((storageInfo.storageUsed / storageInfo.storageQuota) > 0.8) {
      message.warning('存储空间即将用完，请及时清理');
    }
    
    return true;
  } catch (error) {
    console.error('检查存储配额失败:', error);
    return true; // 检查失败时允许上传
  }
};
```

---

## 完整示例代码

### UserManagement.jsx 完整修改

```jsx
import { DatabaseOutlined } from '@ant-design/icons';
import { Progress, InputNumber, Alert } from 'antd';

// 在组件中添加
const [isQuotaModalVisible, setIsQuotaModalVisible] = useState(false);
const [editingQuotaUser, setEditingQuotaUser] = useState(null);
const [quotaForm] = Form.useForm();

// 添加列
const columns = [
  // ... 现有列
  {
    title: '存储配额',
    dataIndex: 'storageQuota',
    key: 'storageQuota',
    render: (quota) => {
      const gb = ((quota || 10737418240) / (1024 * 1024 * 1024)).toFixed(2);
      return `${gb} GB`;
    }
  },
  {
    title: '已使用',
    dataIndex: 'storageUsed',
    key: 'storageUsed',
    render: (used, record) => {
      const usedGb = ((used || 0) / (1024 * 1024 * 1024)).toFixed(2);
      const quota = record.storageQuota || 10737418240;
      const percentage = ((used || 0) / quota * 100).toFixed(1);
      return (
        <div>
          <div>{usedGb} GB</div>
          <Progress 
            percent={parseFloat(percentage)} 
            size="small"
            status={percentage > 90 ? 'exception' : percentage > 80 ? 'warning' : 'normal'}
          />
        </div>
      );
    }
  },
  {
    title: '操作',
    key: 'action',
    render: (_, record) => (
      <Space>
        {/* 现有按钮 */}
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
];

// 在 return 中添加模态框
return (
  <>
    {/* 现有内容 */}
    
    {/* 配额编辑模态框 */}
    <Modal
      title="设置存储配额"
      open={isQuotaModalVisible}
      onOk={handleQuotaSubmit}
      onCancel={() => {
        setIsQuotaModalVisible(false);
        quotaForm.resetFields();
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
              message: '配额必须在 1-1000 GB 之间',
              transform: (value) => Number(value)
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
  </>
);
```

---

## 测试步骤

### 1. 测试查看存储信息
```bash
# 登录后访问
http://localhost:8001/users

# 应该看到每个用户的存储配额和使用情况
```

### 2. 测试修改配额
```bash
# 点击用户的"配额"按钮
# 输入新的配额值（如 20）
# 点击确定
# 应该看到配额更新成功
```

### 3. 测试上传限制
```bash
# 上传一个超过配额的大文件
# 应该看到"存储空间不足"的错误提示
```

---

## 注意事项

1. **权限控制**: 只有管理员可以修改配额
2. **实时更新**: 上传/删除文件后自动更新存储使用量
3. **回收站**: 回收站的文件也计入存储使用量
4. **永久删除**: 只有永久删除才释放存储空间

---

## 快速集成清单

- [ ] 在 UserManagement.jsx 添加存储配额列
- [ ] 添加配额编辑模态框
- [ ] 添加配额更新 API 调用
- [ ] 在 Dashboard.jsx 显示存储信息
- [ ] 在文件上传前检查配额
- [ ] 测试所有功能
- [ ] 部署到生产环境

---

**完成后，用户管理页面将显示每个用户的存储使用情况，管理员可以方便地调整配额！**
