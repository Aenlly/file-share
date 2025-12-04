# 断点续传功能实现

## 实现时间：2024-12-04

## 功能概述

实现了完整的断点续传和并发安全的文件上传功能，解决了并发上传冲突问题。

---

## 🎯 解决的问题

### 1. 并发上传冲突
- **问题**：多个用户同时上传同名文件可能导致数据不一致
- **解决**：使用上传会话管理，每个上传有唯一ID

### 2. 上传中断
- **问题**：网络中断或浏览器关闭导致上传失败
- **解决**：支持断点续传，可从中断处继续上传

### 3. 内存占用
- **问题**：大文件上传占用大量内存
- **解决**：分片存储到磁盘，按需合并

---

## 📁 新增文件

### 1. UploadSessionModel.js
**路径**：`backend/src/models/UploadSessionModel.js`

**功能**：
- 管理上传会话
- 记录上传进度
- 支持断点续传
- 自动清理过期会话

**主要方法**：
```javascript
- createSession()        // 创建上传会话
- findByUploadId()       // 查询会话
- updateUploadedChunks() // 更新已上传分片
- getMissingChunks()     // 获取缺失分片
- completeSession()      // 完成上传
- cancelSession()        // 取消上传
- cleanupExpiredSessions() // 清理过期会话
```

### 2. chunkUploadRoutes.v2.js
**路径**：`backend/src/routes/chunkUploadRoutes.v2.js`

**功能**：
- 改进的分片上传路由
- 支持断点续传
- 并发安全
- 进度查询

---

## 🔄 工作流程

### 1. 初始化上传
```
客户端 -> POST /api/folders/:folderId/chunk/init
{
  fileName: "large-file.zip",
  fileSize: 104857600,
  fileHash: "sha256...",  // 可选
  resumeUploadId: "..."   // 断点续传时提供
}

服务器 -> 响应
{
  uploadId: "1733328000000_abc123",
  fileName: "large-file.zip",
  totalChunks: 20,
  chunkSize: 5242880,
  resumed: false
}
```

### 2. 上传分片
```
客户端 -> POST /api/folders/:folderId/chunk
{
  uploadId: "1733328000000_abc123",
  chunkIndex: 0,
  chunk: "base64_encoded_data"
}

服务器 -> 响应
{
  success: true,
  chunkIndex: 0,
  uploadedChunks: 1,
  totalChunks: 20,
  progress: 5
}
```

### 3. 查询进度（断点续传）
```
客户端 -> GET /api/folders/:folderId/chunk/progress/:uploadId

服务器 -> 响应
{
  uploadId: "1733328000000_abc123",
  totalChunks: 20,
  uploadedChunks: 15,
  missingChunks: [16, 17, 18, 19],
  progress: 75,
  status: "uploading"
}
```

### 4. 完成上传
```
客户端 -> POST /api/folders/:folderId/chunk/complete
{
  uploadId: "1733328000000_abc123"
}

服务器 -> 响应
{
  success: true,
  file: {
    id: 123,
    originalName: "large-file.zip",
    savedName: "1733328000000_large-file.zip",
    size: 104857600,
    hash: "sha256..."
  }
}
```

---

## 🔒 并发安全机制

### 1. 唯一上传ID
- 每个上传会话有唯一ID
- 避免不同上传之间的冲突

### 2. 分片去重
- 检查分片是否已上传
- 支持重传相同分片

### 3. 文件哈希验证
- 上传完成后验证文件完整性
- 检查文件是否已存在

### 4. 原子操作
- 使用数据库事务
- 确保数据一致性

---

## 💾 存储结构

### 临时文件目录
```
temp/uploads/
├── 1733328000000_abc123/
│   ├── chunk_0
│   ├── chunk_1
│   ├── chunk_2
│   └── ...
└── 1733328000001_def456/
    ├── chunk_0
    └── ...
```

### 数据库表结构
```javascript
upload_sessions: {
  id: 1,
  uploadId: "1733328000000_abc123",
  folderId: 10,
  fileName: "large-file.zip",
  fileSize: 104857600,
  fileHash: "sha256...",
  totalChunks: 20,
  chunkSize: 5242880,
  uploadedChunks: [0, 1, 2, 3, 4],
  status: "uploading",
  owner: "user1",
  createdAt: "2024-12-04T10:00:00Z",
  expiresAt: "2024-12-05T10:00:00Z"
}
```

---

## 🎨 前端集成示例

### 基础上传
```javascript
async function uploadLargeFile(file, folderId) {
  const chunkSize = 5 * 1024 * 1024; // 5MB
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // 1. 初始化上传
  const initRes = await api.post(`/folders/${folderId}/chunk/init`, {
    fileName: file.name,
    fileSize: file.size
  });
  
  const { uploadId } = initRes.data;
  
  // 2. 上传分片
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    const reader = new FileReader();
    const chunkBase64 = await new Promise((resolve) => {
      reader.onload = (e) => resolve(e.target.result.split(',')[1]);
      reader.readAsDataURL(chunk);
    });
    
    await api.post(`/folders/${folderId}/chunk`, {
      uploadId,
      chunkIndex: i,
      chunk: chunkBase64
    });
    
    // 更新进度
    const progress = Math.round(((i + 1) / totalChunks) * 100);
    console.log(`上传进度: ${progress}%`);
  }
  
  // 3. 完成上传
  const completeRes = await api.post(`/folders/${folderId}/chunk/complete`, {
    uploadId
  });
  
  return completeRes.data;
}
```

### 断点续传
```javascript
async function resumeUpload(file, folderId, uploadId) {
  // 1. 查询进度
  const progressRes = await api.get(
    `/folders/${folderId}/chunk/progress/${uploadId}`
  );
  
  const { missingChunks, chunkSize } = progressRes.data;
  
  // 2. 只上传缺失的分片
  for (const chunkIndex of missingChunks) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    const reader = new FileReader();
    const chunkBase64 = await new Promise((resolve) => {
      reader.onload = (e) => resolve(e.target.result.split(',')[1]);
      reader.readAsDataURL(chunk);
    });
    
    await api.post(`/folders/${folderId}/chunk`, {
      uploadId,
      chunkIndex,
      chunk: chunkBase64
    });
  }
  
  // 3. 完成上传
  return await api.post(`/folders/${folderId}/chunk/complete`, {
    uploadId
  });
}
```

---

## 🧪 测试场景

### 1. 正常上传
```bash
# 上传100MB文件
curl -X POST /api/folders/1/chunk/init \
  -d '{"fileName":"test.zip","fileSize":104857600}'
```

### 2. 断点续传
```bash
# 查询进度
curl -X GET /api/folders/1/chunk/progress/1733328000000_abc123

# 继续上传
curl -X POST /api/folders/1/chunk/init \
  -d '{"fileName":"test.zip","fileSize":104857600,"resumeUploadId":"1733328000000_abc123"}'
```

### 3. 并发上传
```bash
# 同时上传多个文件
for i in {1..5}; do
  curl -X POST /api/folders/1/chunk/init \
    -d "{\"fileName\":\"file$i.zip\",\"fileSize\":10485760}" &
done
```

---

## ⚙️ 配置选项

### 环境变量
```env
# 分片大小（默认5MB）
CHUNK_SIZE=5242880

# 最大文件大小（默认100MB）
MAX_FILE_SIZE=104857600

# 上传会话过期时间（默认24小时）
UPLOAD_SESSION_EXPIRE_HOURS=24
```

### 清理策略
- 过期会话：24小时后自动清理
- 清理频率：每30分钟检查一次
- 临时文件：会话清理时同步删除

---

## 🔧 部署步骤

### 1. 替换路由文件
```bash
# 备份旧文件
mv backend/src/routes/chunkUploadRoutes.js backend/src/routes/chunkUploadRoutes.old.js

# 使用新文件
mv backend/src/routes/chunkUploadRoutes.v2.js backend/src/routes/chunkUploadRoutes.js
```

### 2. 创建临时目录
```bash
mkdir -p temp/uploads
```

### 3. 重启服务
```bash
cd backend
npm restart
```

---

## 📊 性能优化

### 1. 内存使用
- 分片存储到磁盘
- 按需读取和合并
- 避免大文件占用内存

### 2. 并发处理
- 支持多个分片并发上传
- 独立的上传会话
- 无锁设计

### 3. 网络优化
- 支持断点续传
- 减少重复上传
- 自动重试机制

---

## 🐛 已知限制

1. **临时文件清理**
   - 依赖定时任务
   - 服务重启可能遗留文件

2. **并发限制**
   - 受限于磁盘IO
   - 建议配置上传限流

3. **存储空间**
   - 临时文件占用磁盘
   - 需要监控磁盘使用

---

## 🔮 未来优化

1. **Redis 支持**
   - 使用 Redis 存储会话
   - 支持分布式部署

2. **云存储集成**
   - 支持 S3/OSS
   - 直传到云存储

3. **WebSocket 推送**
   - 实时进度更新
   - 多设备同步

4. **智能分片**
   - 根据网速调整分片大小
   - 自适应重试策略

---

## 总结

本次实现完成了：
- ✅ 断点续传功能
- ✅ 并发上传安全
- ✅ 上传进度管理
- ✅ 自动清理机制
- ✅ 文件完整性验证

系统现在支持大文件上传和断点续传，显著提升了用户体验和系统稳定性。
