# 存储配额限制修复

## 问题描述

分片上传功能缺少存储配额检查和使用量更新，导致：
1. 用户可以通过分片上传绕过存储配额限制
2. 分片上传的文件不计入用户存储使用量

## 修复内容

### 1. 分片上传初始化 - 添加配额检查

**文件**: `backend/src/routes/chunkUploadRoutes.js`

在 `POST /:folderId/chunk/init` 路由中添加：

```javascript
// 检查存储配额
const UserModel = require('../models/UserModel');
const quotaCheck = await UserModel.checkStorageQuota(req.user.username, fileSize);

if (!quotaCheck.allowed) {
    const { formatStorageSize } = require('../utils/storageCalculator');
    return sendError(res, 'STORAGE_QUOTA_EXCEEDED', 
        `存储空间不足。可用: ${formatStorageSize(quotaCheck.storageAvailable)}, 需要: ${formatStorageSize(fileSize)}`
    );
}
```

**作用**：
- 在开始上传前检查用户是否有足够的存储空间
- 如果空间不足，立即拒绝上传，避免浪费带宽和时间

### 2. 分片上传完成 - 更新存储使用量

在 `POST /:folderId/chunk/complete` 路由中添加：

```javascript
// 更新用户存储使用量
const UserModel = require('../models/UserModel');
await UserModel.incrementStorageUsed(uploadInfo.owner, fileBuffer.length);
```

**作用**：
- 文件上传完成后，将文件大小计入用户的存储使用量
- 确保配额统计准确

## 配额检查流程

### 普通上传
1. 用户选择文件
2. **检查存储配额** ✅
3. 上传文件
4. **更新存储使用量** ✅

### 分片上传（修复后）
1. 用户选择文件
2. 初始化分片上传
3. **检查存储配额** ✅ (新增)
4. 上传各个分片
5. 完成上传
6. **更新存储使用量** ✅ (新增)

## 相关 API

### 检查存储配额
```javascript
UserModel.checkStorageQuota(username, additionalSize)
```

返回：
```javascript
{
    allowed: true/false,           // 是否允许上传
    storageQuota: 10737418240,     // 总配额（字节）
    storageUsed: 5368709120,       // 已使用（字节）
    storageAvailable: 5368709120,  // 可用空间（字节）
    additionalSize: 104857600,     // 本次上传大小（字节）
    totalAfterUpload: 5473566720   // 上传后总使用量（字节）
}
```

### 更新存储使用量
```javascript
// 增加
UserModel.incrementStorageUsed(username, size)

// 减少（删除文件时）
UserModel.decrementStorageUsed(username, size)
```

## 默认配额

- **普通用户**: 10GB (10 * 1024 * 1024 * 1024 字节)
- **管理员**: 100GB (100 * 1024 * 1024 * 1024 字节)

管理员可以通过以下 API 修改用户配额：
```
PUT /api/users/:id/storage-quota
Body: { "storageQuota": 21474836480 }  // 20GB
```

## 测试场景

### 场景1：配额充足
1. 用户配额：10GB
2. 已使用：5GB
3. 上传文件：3GB
4. 结果：✅ 上传成功，使用量更新为 8GB

### 场景2：配额不足
1. 用户配额：10GB
2. 已使用：9GB
3. 上传文件：3GB
4. 结果：❌ 上传失败，提示"存储空间不足。可用: 1GB, 需要: 3GB"

### 场景3：分片上传配额检查
1. 用户配额：10GB
2. 已使用：9.5GB
3. 初始化分片上传：1GB 文件
4. 结果：❌ 初始化失败，提示空间不足

## 注意事项

1. **配额检查时机**：在初始化分片上传时检查，而不是每个分片都检查
2. **使用量更新时机**：在文件完全上传完成后更新
3. **回收站文件**：移至回收站的文件仍然占用存储空间，只有永久删除才释放
4. **并发上传**：多个文件同时上传时，配额检查基于当前已使用量，可能存在竞态条件

## 存储使用量更新场景

### 增加存储使用量
1. **普通文件上传** ✅
   - 位置：`backend/src/routes/fileRoutes.js`
   - 时机：文件上传成功后

2. **分片文件上传** ✅ (新增)
   - 位置：`backend/src/routes/chunkUploadRoutes.js`
   - 时机：分片上传完成后

### 减少存储使用量
1. **永久删除单个文件** ✅ (新增)
   - 位置：`backend/src/routes/recycleBinRoutes.js`
   - 时机：从回收站永久删除文件后

2. **清空回收站** ✅ (新增)
   - 位置：`backend/src/routes/recycleBinRoutes.js`
   - 时机：清空回收站后

### 不改变存储使用量
1. **移至回收站** - 文件仍然存在，占用空间
2. **从回收站恢复** - 文件一直占用空间
3. **删除用户** - 用户记录被删除，无需更新

## 相关文件

- `backend/src/routes/chunkUploadRoutes.js` - 分片上传路由（新增配额检查）
- `backend/src/routes/fileRoutes.js` - 普通文件上传路由
- `backend/src/routes/recycleBinRoutes.js` - 回收站路由（新增存储释放）
- `backend/src/models/UserModel.js` - 用户模型（配额管理）
- `backend/src/config/errorCodes.js` - 错误码定义
