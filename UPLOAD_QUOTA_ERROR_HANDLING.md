# 上传存储配额错误处理优化

## 问题描述

当用户上传文件时，如果存储空间不足：
1. 分片上传初始化失败后，前端仍然继续尝试上传分片
2. 错误提示不够友好，用户体验差
3. 批量上传时，遇到配额错误后仍然继续上传其他文件

## 修复内容

### 1. 分片上传初始化检查

**文件**: `frontend/src/components/FolderDetail/FileUploadCard.jsx`

```javascript
// 初始化分片上传
const initResponse = await api.post(`/folders/${folderId}/chunk/init`, {
  fileName: fileName,
  fileSize: file.size
})

// 检查初始化是否成功
if (!initResponse.data || !initResponse.data.uploadId) {
  const errorMsg = initResponse.data?.error || '初始化上传失败'
  console.error('初始化失败:', errorMsg)
  return { success: false, fileName: file.name, error: errorMsg }
}
```

**作用**：
- 检查初始化响应是否包含 `uploadId`
- 如果初始化失败（如存储空间不足），立即返回错误，不继续上传

### 2. 改进错误信息提取

```javascript
catch (error) {
  // 提取错误信息
  let errorMessage = error.message
  if (error.response?.data?.error) {
    errorMessage = error.response.data.error
  } else if (error.response?.data?.message) {
    errorMessage = error.response.data.message
  }
  
  // 特殊处理存储配额错误
  if (error.response?.data?.code === 'APF903') {
    errorMessage = error.response.data.error || '存储空间不足'
  }
  
  return { success: false, fileName: file.name, error: errorMessage }
}
```

**作用**：
- 优先使用后端返回的详细错误信息
- 识别存储配额错误码 `APF903`
- 返回友好的错误提示

### 3. 批量上传时遇到配额错误立即停止

```javascript
for (const file of fileList) {
  const result = await uploadFileInChunks(file)
  results.push(result)
  
  // 如果遇到存储配额错误，停止后续上传
  if (!result.success && result.error && result.error.includes('存储空间不足')) {
    message.error(`存储空间不足，已停止上传。${result.error}`)
    // 将剩余文件标记为跳过
    const remainingFiles = fileList.slice(results.length)
    remainingFiles.forEach(f => {
      results.push({ success: false, fileName: f.name, error: '因存储空间不足而跳过' })
    })
    break
  }
}
```

**作用**：
- 检测到存储配额错误后立即停止上传
- 避免浪费带宽和时间尝试上传注定失败的文件
- 显示清晰的错误提示

### 4. 普通上传的配额错误处理

```javascript
else if (error.response?.data?.code === 'APF903') {
  // 存储配额错误
  message.error(error.response.data.error || '存储空间不足')
}
```

**作用**：
- 识别普通上传的存储配额错误
- 显示友好的错误提示

## 用户体验改进

### 修复前
1. ❌ 初始化失败后仍然尝试上传分片
2. ❌ 显示通用错误信息："上传失败"
3. ❌ 批量上传时继续尝试所有文件
4. ❌ 浪费时间和带宽

### 修复后
1. ✅ 初始化失败立即停止
2. ✅ 显示详细错误："存储空间不足。可用: 102.40 MB, 需要: 297.48 MB"
3. ✅ 遇到配额错误立即停止批量上传
4. ✅ 节省时间和带宽

## 错误流程

### 分片上传
```
用户选择文件 (297.48 MB)
    ↓
初始化分片上传
    ↓
检查存储配额 (可用: 102.40 MB)
    ↓
❌ 配额不足，返回错误
    ↓
前端收到错误，显示提示
    ↓
停止上传，不继续上传分片
```

### 批量上传
```
用户选择 5 个文件
    ↓
上传第 1 个文件 ✅ 成功
    ↓
上传第 2 个文件 ✅ 成功
    ↓
上传第 3 个文件 ❌ 存储空间不足
    ↓
显示错误提示，停止上传
    ↓
第 4、5 个文件标记为"因存储空间不足而跳过"
```

## 相关错误码

- **APF903**: `STORAGE_QUOTA_EXCEEDED` - 存储空间不足

## 测试场景

### 场景1：单文件上传配额不足
1. 用户配额：10GB
2. 已使用：9.9GB
3. 上传文件：200MB
4. 结果：❌ 初始化失败，显示"存储空间不足。可用: 102.40 MB, 需要: 200 MB"

### 场景2：批量上传中途配额不足
1. 用户配额：10GB
2. 已使用：9.5GB
3. 上传 3 个文件：每个 200MB
4. 结果：
   - 第 1 个文件：✅ 成功
   - 第 2 个文件：✅ 成功
   - 第 3 个文件：❌ 配额不足，停止上传

### 场景3：分片上传配额不足
1. 用户配额：10GB
2. 已使用：9.9GB
3. 初始化分片上传：1GB 文件
4. 结果：❌ 初始化失败，不上传任何分片

## 相关文件

- `frontend/src/components/FolderDetail/FileUploadCard.jsx` - 上传组件
- `backend/src/routes/chunkUploadRoutes.js` - 分片上传路由
- `backend/src/routes/fileRoutes.js` - 普通上传路由
- `backend/src/models/UserModel.js` - 用户模型（配额检查）
