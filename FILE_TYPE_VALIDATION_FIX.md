# 文件类型验证修复

## 问题描述

用户可以上传 `.exe` 等危险文件类型，服务端的文件类型验证没有生效。

## 问题分析

### 1. 普通上传

普通文件上传（`fileRoutes.js`）已经有文件类型检查：

```javascript
// 文件类型检查
const typeValidation = validateFileType(originalName, config);
if (!typeValidation.valid) {
    errorFiles.push({
        filename: originalName,
        error: typeValidation.error
    });
    continue;
}
```

✅ 正常工作

### 2. 分片上传

分片上传（`chunkUploadRoutes.js`）的初始化阶段**缺少**文件类型检查：

```javascript
// ❌ 缺少文件类型检查
await UploadSessionModel.createSession({
    uploadId,
    folderId,
    fileName: originalName,
    fileSize,
    owner: req.user.username
});
```

❌ 没有验证，导致危险文件可以上传

## 修复方案

### 在分片上传初始化时添加文件类型检查

**文件**: `backend/src/routes/chunkUploadRoutes.js`

```javascript
// 文件类型检查
const { validateFileType, sanitizeFilename } = require('../middleware/validation');
originalName = sanitizeFilename(originalName);

const typeValidation = validateFileType(originalName, config);
if (!typeValidation.valid) {
    return sendError(res, 'FILE_TYPE_NOT_ALLOWED', typeValidation.error);
}
```

**位置**: 在创建上传会话之前

## 文件类型验证逻辑

### 危险文件类型（黑名单）

**配置**: `backend/src/config/index.js`

```javascript
dangerousFileTypes: [
    '.exe',  // Windows 可执行文件
    '.bat',  // Windows 批处理文件
    '.cmd',  // Windows 命令文件
    '.sh',   // Shell 脚本
    '.ps1',  // PowerShell 脚本
    '.vbs',  // VBScript
    '.js',   // JavaScript（服务端执行风险）
    '.jar',  // Java 可执行文件
    '.app',  // macOS 应用
    '.dmg',  // macOS 磁盘镜像
    '.deb',  // Debian 包
    '.rpm'   // RedHat 包
]
```

### 验证函数

**文件**: `backend/src/middleware/validation.js`

```javascript
function validateFileType(filename, config) {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    
    // 检查是否为危险文件类型
    if (config.dangerousFileTypes && config.dangerousFileTypes.includes(ext)) {
        return {
            valid: false,
            error: `不允许上传 ${ext} 类型的文件（安全限制）`
        };
    }
    
    return { valid: true };
}
```

## 错误处理

### 后端错误码

**错误码**: `APF603`
**消息**: "不支持的文件类型"

### 前端处理

**文件**: `frontend/src/utils/api.js`

```javascript
case 'APF603': // 文件类型不允许
    errorMessage = data.error || '不支持的文件类型'
    break
```

## 测试场景

### 场景1：上传危险文件（普通上传）

```bash
# 尝试上传 .exe 文件
curl -X POST http://localhost:3000/api/folders/1/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "files=@test.exe"

# 预期响应
{
  "success": true,
  "uploadedFiles": [],
  "existingFiles": [],
  "errorFiles": [
    {
      "filename": "test.exe",
      "error": "不允许上传 .exe 类型的文件（安全限制）"
    }
  ],
  "total": 1
}
```

### 场景2：上传危险文件（分片上传）

```bash
# 初始化分片上传 .exe 文件
curl -X POST http://localhost:3000/api/folders/1/chunk/init \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "malware.exe",
    "fileSize": 1024000
  }'

# 预期响应
{
  "success": false,
  "code": "APF603",
  "error": "不允许上传 .exe 类型的文件（安全限制）"
}
```

### 场景3：上传正常文件

```bash
# 上传 .pdf 文件
curl -X POST http://localhost:3000/api/folders/1/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "files=@document.pdf"

# 预期响应
{
  "success": true,
  "uploadedFiles": [
    {
      "id": 123,
      "originalName": "document.pdf",
      "savedName": "1234567890_document.pdf",
      "size": 102400
    }
  ],
  "existingFiles": [],
  "errorFiles": [],
  "total": 1
}
```

## 用户体验

### 修复前

1. 用户上传 `.exe` 文件
2. 文件上传成功
3. ❌ 安全风险

### 修复后

1. 用户上传 `.exe` 文件
2. 前端显示错误："不允许上传 .exe 类型的文件（安全限制）"
3. ✅ 文件被拒绝，系统安全

## 扩展配置

### 添加更多危险文件类型

编辑 `backend/src/config/index.js`：

```javascript
dangerousFileTypes: [
    // 现有类型
    '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar',
    '.app', '.dmg', '.deb', '.rpm',
    
    // 新增类型
    '.msi',  // Windows 安装包
    '.scr',  // Windows 屏保（可执行）
    '.com',  // DOS 可执行文件
    '.pif',  // Windows 程序信息文件
    '.apk',  // Android 应用
    '.ipa',  // iOS 应用
]
```

### 通过环境变量配置

可以在 `.env` 中添加：

```env
# 危险文件类型（逗号分隔）
DANGEROUS_FILE_TYPES=.exe,.bat,.cmd,.sh,.ps1,.vbs,.js,.jar
```

然后在 `config/index.js` 中读取：

```javascript
dangerousFileTypes: process.env.DANGEROUS_FILE_TYPES 
    ? process.env.DANGEROUS_FILE_TYPES.split(',')
    : ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar', '.app', '.dmg', '.deb', '.rpm'],
```

## 相关文件

- `backend/src/routes/chunkUploadRoutes.js` - 分片上传路由（已修复）
- `backend/src/routes/fileRoutes.js` - 普通上传路由（已有验证）
- `backend/src/middleware/validation.js` - 文件类型验证函数
- `backend/src/config/index.js` - 危险文件类型配置
- `backend/src/config/errorCodes.js` - 错误码定义
- `frontend/src/utils/api.js` - 前端错误处理

## 注意事项

1. **重启服务器**：修改后需要重启后端服务器
2. **大小写不敏感**：文件扩展名检查不区分大小写（`.EXE` 和 `.exe` 都会被拒绝）
3. **文件名编码**：支持 UTF-8 编码的文件名
4. **错误提示**：前端会显示友好的中文错误提示
5. **安全优先**：建议保持严格的文件类型限制

## 安全建议

1. **定期审查**：定期审查和更新危险文件类型列表
2. **病毒扫描**：考虑集成病毒扫描服务（如 ClamAV）
3. **文件隔离**：上传的文件应存储在无执行权限的目录
4. **内容检查**：不仅检查扩展名，还应检查文件内容（Magic Number）
5. **用户教育**：提示用户不要上传可执行文件
