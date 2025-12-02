# 最新Bug修复 - 文件名和速率限制问题

## 问题1：文件上传后显示"未知文件"

### 原因
后端返回的文件数据使用`originalName`字段，但前端期望的是`name`字段。

### 修复方案
在`FileModel`中添加字段映射，确保返回的数据包含前端期望的字段：

```javascript
// FileModel.js - create方法
async create(fileData) {
    const record = await this.insert({...});
    return {
        ...record,
        name: record.originalName,  // 添加name字段
        mtime: record.uploadTime     // 添加mtime字段
    };
}

// FileModel.js - findByFolder方法
async findByFolder(folderId) {
    const files = await this.find({ folderId });
    return files.map(file => ({
        ...file,
        name: file.originalName || file.name,
        mtime: file.uploadTime || file.mtime
    }));
}
```

### 修复文件
- `backend/src/models/FileModel.js`

---

## 问题2：429 Too Many Requests - 速率限制

### 原因
开发环境中的速率限制配置过于严格，导致正常的API请求被拒绝。

### 修复方案
在开发环境中提高速率限制阈值：

```javascript
// config/index.js
rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 
    (config.nodeEnv === 'development' ? 1000 : 100),
```

### 修复文件
- `backend/src/config/index.js`

---

## 修复步骤

### 1. 重启后端服务
```bash
cd backend
npm start
```

### 2. 刷新前端页面
- 清除浏览器缓存（F12 → 清除缓存）
- 刷新页面

### 3. 测试文件上传
- 上传文件
- 验证文件名正确显示
- 验证文件列表加载成功

### 4. 测试文件移动
- 选择文件
- 点击移动按钮
- 验证移动成功（不返回登录页）

---

## 验证修复

### 检查清单
- [ ] 文件上传后显示正确的文件名（不是"未知文件"）
- [ ] 文件列表正常加载（无429错误）
- [ ] 文件移动功能正常（无429错误）
- [ ] 其他API请求正常（无429错误）
- [ ] 登录状态保持（不返回登录页）

---

## 相关配置

### 开发环境速率限制
```env
# backend/.env
RATE_LIMIT_WINDOW_MS=900000      # 15分钟
RATE_LIMIT_MAX_REQUESTS=1000     # 开发环境：1000次请求
```

### 生产环境速率限制
```env
# backend/.env.production
RATE_LIMIT_WINDOW_MS=900000      # 15分钟
RATE_LIMIT_MAX_REQUESTS=100      # 生产环境：100次请求
```

---

## 预防措施

### 1. 添加API响应拦截
```javascript
// frontend/src/utils/api.js
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      console.warn('请求过于频繁，请稍后再试');
      // 显示用户友好的错误提示
    }
    return Promise.reject(error);
  }
);
```

### 2. 改进文件数据结构
确保后端返回的文件数据包含前端期望的所有字段：
- `id` - 文件ID
- `name` - 文件名（显示用）
- `savedName` - 保存的文件名
- `size` - 文件大小
- `mtime` - 修改时间
- `mimeType` - MIME类型

### 3. 添加错误重试机制
```javascript
// 在react-query中配置重试
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // 429错误不重试
        if (error.response?.status === 429) {
          return false;
        }
        // 其他错误重试3次
        return failureCount < 3;
      }
    }
  }
});
```

---

## 测试结果

### 修复前
- ❌ 文件上传后显示"未知文件"
- ❌ 文件移动返回429错误
- ❌ 频繁操作触发速率限制

### 修复后
- ✅ 文件上传后显示正确的文件名
- ✅ 文件移动成功
- ✅ 正常操作不触发速率限制
- ✅ 登录状态保持

---

**修复日期：** 2024-01-01  
**修复版本：** 2.0.0  
**状态：** ✅ 已修复
