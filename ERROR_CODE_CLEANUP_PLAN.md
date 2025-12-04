# 错误码清理计划

## 需要立即处理的文件

### 1. backend/src/routes/fileRoutes.js
**位置**: 行 240-327  
**问题**: 6 处使用 `res.status(404/403).json()` 但已包含 code 字段  
**建议**: 统一改为 `sendError(res, 'ERROR_CODE')`

```javascript
// 当前格式
return res.status(404).json({ 
    success: false, 
    code: 'FOLDER_NOT_FOUND',
    error: '文件夹不存在' 
});

// 应改为
return sendError(res, 'FOLDER_NOT_FOUND');
```

### 2. backend/src/routes/chunkUploadRoutes.js
**位置**: 行 135  
**问题**: 1 处 409 冲突响应  
**建议**: 改为业务错误码

```javascript
// 当前
return res.status(409).json({ 
    error: '文件已存在',
    existingFile: existingByHash.originalName 
});

// 建议改为
return res.status(200).json({
    success: false,
    code: 'FILE_ALREADY_EXISTS',
    error: '文件已存在',
    existingFile: existingByHash.originalName
});
```

### 3. backend/src/app.js
**位置**: 行 134  
**问题**: 404 路由未找到响应  
**建议**: 改为 sendError

```javascript
// 当前
res.status(404).json({ error: '接口不存在' });

// 应改为
const { sendError } = require('./config/errorCodes');
sendError(res, 'RESOURCE_NOT_FOUND', '接口不存在');
```

## 需要删除的文件（旧架构）

### backend/src/controllers/
这些文件是旧的 MVC 架构代码，当前系统已改为直接在 routes 中处理业务逻辑：

1. **backend/src/controllers/userController.js** - 12 处 HTTP 状态码
2. **backend/src/controllers/shareController.js** - 9 处 HTTP 状态码
3. **backend/src/controllers/folderController.js** - 5 处 HTTP 状态码
4. **backend/src/controllers/fileMoveController.js** - 4 处 HTTP 状态码

**建议操作**:
1. 确认这些文件是否还在使用
2. 如果未使用，直接删除
3. 如果还在使用，需要迁移到新的 routes 架构

## 检查方法

```bash
# 检查 controllers 是否被引用
grep -r "require.*controllers" backend/src/

# 如果没有输出，说明这些文件已废弃，可以安全删除
```

## 优先级

1. **高优先级**: app.js 的 404 响应（影响所有未匹配的路由）
2. **中优先级**: fileRoutes.js 和 chunkUploadRoutes.js（核心业务功能）
3. **低优先级**: controllers 目录（如果确认未使用，直接删除即可）

## 预期效果

完成后，整个后端将完全使用统一的 APF 业务错误码系统，所有错误响应格式一致：

```javascript
{
    success: false,
    code: 'APF3XX',
    error: '错误描述'
}
```
