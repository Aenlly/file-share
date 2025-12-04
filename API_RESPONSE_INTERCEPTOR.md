# API 响应拦截器全局错误处理

## 问题描述

之前的实现存在以下问题：
1. HTTP 状态码 200 不代表业务逻辑成功，但前端没有统一检查
2. 每个组件都需要单独处理错误信息提取
3. 错误码匹配逻辑分散在各个组件中
4. 代码重复，维护困难

## 解决方案

在 axios 响应拦截器中统一处理所有 API 响应和错误。

### 文件位置
`frontend/src/utils/api.js`

## 实现细节

### 1. 业务逻辑错误检查

即使 HTTP 状态码是 200，也要检查响应数据中的 `success` 字段：

```javascript
api.interceptors.response.use(
  (response) => {
    // 检查响应数据中的 success 字段
    if (response.data && response.data.success === false) {
      const error = new Error(response.data.error || response.data.message || '操作失败')
      error.response = {
        data: response.data,
        status: response.status,
        statusText: response.statusText
      }
      error.code = response.data.code
      return Promise.reject(error)
    }
    return response
  },
  // ...
)
```

**作用**：
- 将业务逻辑失败转换为 Promise rejection
- 统一错误处理流程
- 组件可以用 try-catch 捕获所有错误

### 2. 统一错误码处理

根据后端返回的错误码，提供友好的错误提示：

```javascript
// 根据错误码提供友好提示
if (data?.code) {
  switch (data.code) {
    case 'APF903': // 存储配额超限
      errorMessage = data.error || '存储空间不足'
      break
    case 'APF901': // 请求过于频繁
      errorMessage = '请求过于频繁，请稍后再试'
      break
    case 'APF102': // 认证失败
    case 'APF103': // Token无效
    case 'APF104': // Token过期
      errorMessage = '登录已过期，请重新登录'
      break
    case 'APF202': // 权限不足
      errorMessage = '权限不足，无法执行此操作'
      break
    case 'APF301': // 资源不存在
      errorMessage = data.error || '资源不存在'
      break
    case 'APF401': // 参数缺失
    case 'APF402': // 参数无效
      errorMessage = data.error || '请求参数错误'
      break
    default:
      // 使用后端返回的错误信息
      break
  }
}

// 将错误信息附加到 error 对象
error.message = errorMessage
error.code = data.code
```

**作用**：
- 集中管理所有错误码的提示信息
- 提供一致的用户体验
- 便于维护和更新

### 3. 组件简化

组件中不再需要复杂的错误处理逻辑：

**修改前**：
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

**修改后**：
```javascript
catch (error) {
  // 错误信息已经在拦截器中处理
  const errorMessage = error.message
  return { success: false, fileName: file.name, error: errorMessage, code: error.code }
}
```

## 支持的错误码

### HTTP 状态码
- `401`: 未授权（自动重定向到登录页）
- `429`: 请求过于频繁（限流）

### 认证相关 (APF1xx)
- `APF102`: 认证失败
- `APF103`: Token 无效
- `APF104`: Token 过期

### 权限相关 (APF2xx)
- `APF202`: 权限不足

### 资源相关 (APF3xx)
- `APF301`: 资源不存在

### 参数相关 (APF4xx)
- `APF401`: 参数缺失
- `APF402`: 参数无效

### 系统限制 (APF9xx)
- `APF901`: 请求过于频繁
- `APF903`: 存储配额超限

## 使用示例

### 组件中使用

```javascript
try {
  const response = await api.post('/folders/1/chunk/init', {
    fileName: 'test.txt',
    fileSize: 1024
  })
  // 成功处理
  console.log(response.data)
} catch (error) {
  // 统一错误处理
  message.error(error.message)
  
  // 可以根据错误码做特殊处理
  if (error.code === 'APF903') {
    // 存储空间不足的特殊处理
  } else if (error.code === 'RATE_LIMIT') {
    // 限流的特殊处理
    console.log('请求过于频繁，请稍后再试')
  }
}
```

### 批量操作中断

```javascript
for (const file of fileList) {
  try {
    const result = await uploadFile(file)
    results.push({ success: true, ...result })
  } catch (error) {
    results.push({ success: false, error: error.message, code: error.code })
    
    // 遇到配额错误立即停止
    if (error.code === 'APF903') {
      message.error(`存储空间不足，已停止上传`)
      break
    }
  }
}
```

## 优势

### 1. 代码简洁
- 组件中不需要重复的错误处理逻辑
- 减少代码量约 50%

### 2. 维护性好
- 错误提示集中管理
- 修改一处，全局生效

### 3. 一致性强
- 所有错误都经过统一处理
- 用户体验一致

### 4. 扩展性好
- 新增错误码只需在拦截器中添加
- 不需要修改各个组件

## 注意事项

1. **错误码必须一致**：前后端的错误码定义必须保持一致
2. **错误信息优先级**：拦截器处理的错误信息 > 后端返回的原始信息
3. **特殊错误处理**：某些错误（如 401）需要特殊处理（重定向登录）
4. **错误对象结构**：确保 error 对象包含 `message` 和 `code` 属性

## 相关文件

- `frontend/src/utils/api.js` - axios 实例和拦截器
- `backend/src/config/errorCodes.js` - 后端错误码定义
- `frontend/src/components/FolderDetail/FileUploadCard.jsx` - 使用示例
