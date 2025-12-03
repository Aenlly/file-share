# 分片上传功能实现

## 问题描述
启用分片上传时，前端请求 `/api/folders/:folderId/chunk/init` 返回 404 错误，因为后端没有实现分片上传的API端点。

## 实现内容

### 新增的API端点

#### 1. 初始化分片上传
**端点**: `POST /api/folders/:folderId/chunk/init`

**请求体**:
```json
{
  "fileName": "example.jpg",
  "fileSize": 1048576
}
```

**响应**:
```json
{
  "uploadId": "1701234567890_abc123def",
  "fileName": "example.jpg"
}
```

**功能**:
- 验证文件夹权限
- 生成唯一的上传ID
- 初始化分片上传会话
- 解码UTF8编码的文件名

#### 2. 上传分片
**端点**: `POST /api/folders/:folderId/chunk`

**请求体**:
```json
{
  "uploadId": "1701234567890_abc123def",
  "chunkIndex": 0,
  "chunk": "base64编码的分片数据"
}
```

**响应**:
```json
{
  "success": true,
  "chunkIndex": 0
}
```

**功能**:
- 验证上传会话
- 接收base64编码的分片数据
- 将分片转换为Buffer并存储
- 记录分片索引

#### 3. 完成分片上传
**端点**: `POST /api/folders/:folderId/chunk/complete`

**请求体**:
```json
{
  "uploadId": "1701234567890_abc123def"
}
```

**响应**:
```json
{
  "success": true,
  "file": {
    "id": 123,
    "originalName": "example.jpg",
    "savedName": "1701234567890_abc123def_example.jpg",
    "size": 1048576
  }
}
```

**功能**:
- 合并所有分片
- 计算文件哈希值
- 检查文件是否已存在（通过哈希）
- 保存文件到磁盘
- 创建文件记录
- 清理上传会话

## 技术实现细节

### 1. 内存存储
使用 `Map` 对象存储分片上传会话：
```javascript
const chunkUploads = new Map();
```

每个会话包含：
- `folderId`: 文件夹ID
- `fileName`: 原始文件名
- `fileSize`: 文件大小
- `chunks`: 分片数组
- `owner`: 上传者用户名
- `createdAt`: 创建时间

### 2. 分片处理
- 前端将文件分成200KB的分片
- 每个分片使用base64编码传输
- 后端接收后转换为Buffer存储
- 完成时合并所有分片

### 3. 文件去重
使用MD5哈希值检测重复文件：
```javascript
const fileHash = calculateFileHash(fileBuffer);
const existingByHash = await FileModel.findByHash(fileHash, folderId);
```

### 4. 会话清理
定期清理超过1小时的过期会话：
```javascript
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [uploadId, uploadInfo] of chunkUploads.entries()) {
    if (now - uploadInfo.createdAt > oneHour) {
      chunkUploads.delete(uploadId);
    }
  }
}, 10 * 60 * 1000); // 每10分钟检查一次
```

## 前端使用示例

```javascript
// 1. 初始化上传
const initResponse = await api.post(`/folders/${folderId}/chunk/init`, {
  fileName: file.name,
  fileSize: file.size
});
const { uploadId } = initResponse.data;

// 2. 上传分片
const CHUNK_SIZE = 200 * 1024; // 200KB
const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
  const start = chunkIndex * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const chunk = file.slice(start, end);
  
  // 转换为base64
  const reader = new FileReader();
  const chunkBase64 = await new Promise((resolve) => {
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.readAsDataURL(chunk);
  });
  
  // 上传分片
  await api.post(`/folders/${folderId}/chunk`, {
    uploadId,
    chunkIndex,
    chunk: chunkBase64
  });
}

// 3. 完成上传
await api.post(`/folders/${folderId}/chunk/complete`, { uploadId });
```

## 错误处理

### 常见错误码
- **400**: 缺少必要参数或参数错误
- **403**: 无权访问文件夹
- **404**: 文件夹不存在或上传会话不存在
- **409**: 文件已存在（通过哈希检测）

### 错误响应示例
```json
{
  "error": "上传会话不存在或已过期"
}
```

## 优势

### 1. 支持大文件上传
- 不受HTTP请求大小限制
- 可以上传超过500MB的文件

### 2. 断点续传支持
- 可以记录已上传的分片
- 失败后可以只重传失败的分片

### 3. 内存优化
- 分片处理，不需要一次性加载整个文件到内存
- 定期清理过期会话

### 4. 文件去重
- 使用哈希值检测重复文件
- 避免存储相同内容的文件

## 注意事项

### 1. 内存使用
- 分片数据临时存储在内存中
- 大量并发上传可能占用较多内存
- 建议监控服务器内存使用情况

### 2. 会话过期
- 上传会话1小时后自动过期
- 如果上传时间过长，需要重新初始化

### 3. 并发限制
- 建议限制同时上传的文件数量
- 避免过多并发请求

### 4. 生产环境优化建议
- 使用Redis等外部存储替代内存Map
- 实现更完善的断点续传机制
- 添加上传进度持久化
- 实现分片校验（如MD5）

## 测试建议

1. **小文件测试** (< 200KB)
   - 验证单分片上传

2. **中等文件测试** (1-10MB)
   - 验证多分片上传和合并

3. **大文件测试** (> 100MB)
   - 验证性能和内存使用

4. **重复文件测试**
   - 上传相同文件，验证去重功能

5. **并发测试**
   - 同时上传多个文件

6. **异常测试**
   - 中断上传，验证会话清理
   - 上传到不存在的文件夹
   - 无权限上传

## 部署说明

### 需要重启的服务
✅ **后端需要重启**（添加了新的路由）

### 重启命令
```bash
# 开发环境
npm run dev

# 生产环境
pm2 restart photo-manager
```

## 状态
✅ 已实现分片上传初始化端点
✅ 已实现分片上传端点
✅ 已实现分片上传完成端点
✅ 已实现会话清理机制
✅ 已实现文件去重检测
✅ 前端已有完整的分片上传逻辑
