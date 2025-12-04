# 文件类型验证测试

## 测试场景

### 场景1：上传单个危险文件

**操作**：
1. 选择一个 `.exe` 文件
2. 点击上传

**预期结果**：
- 前端显示错误提示：`test.exe: 不允许上传 .exe 类型的文件（安全限制）`
- 文件不会被上传

**实际响应**：
```json
{
  "success": false,
  "code": "APF603",
  "error": "不允许上传 .exe 类型的文件（安全限制）"
}
```

### 场景2：批量上传（包含危险文件）

**操作**：
1. 选择多个文件：
   - `document.pdf` ✅
   - `image.jpg` ✅
   - `malware.exe` ❌
   - `script.bat` ❌
   - `data.xlsx` ✅
2. 点击上传

**预期结果**：
- 成功提示：`成功上传 3 个文件`
- 错误提示1：`malware.exe: 不允许上传 .exe 类型的文件（安全限制）`
- 错误提示2：`script.bat: 不允许上传 .bat 类型的文件（安全限制）`

**实际响应**：
```json
{
  "success": true,
  "uploadedFiles": [
    {
      "id": 1,
      "originalName": "document.pdf",
      "savedName": "1234567890_document.pdf",
      "size": 102400
    },
    {
      "id": 2,
      "originalName": "image.jpg",
      "savedName": "1234567890_image.jpg",
      "size": 204800
    },
    {
      "id": 3,
      "originalName": "data.xlsx",
      "savedName": "1234567890_data.xlsx",
      "size": 51200
    }
  ],
  "existingFiles": [],
  "errorFiles": [
    {
      "filename": "malware.exe",
      "error": "不允许上传 .exe 类型的文件（安全限制）"
    },
    {
      "filename": "script.bat",
      "error": "不允许上传 .bat 类型的文件（安全限制）"
    }
  ],
  "total": 5
}
```

### 场景3：分片上传危险文件

**操作**：
1. 选择一个大的 `.exe` 文件（>10MB）
2. 启用分片上传
3. 点击上传

**预期结果**：
- 初始化阶段就被拒绝
- 错误提示：`virus.exe: 不允许上传 .exe 类型的文件（安全限制）`
- 不会上传任何分片

**实际响应**（初始化阶段）：
```json
{
  "success": false,
  "code": "APF603",
  "error": "不允许上传 .exe 类型的文件（安全限制）"
}
```

### 场景4：混合上传（存储配额不足 + 文件类型错误）

**操作**：
1. 用户剩余空间：100MB
2. 选择文件：
   - `large-video.mp4` (200MB) ❌ 配额不足
   - `malware.exe` (1MB) ❌ 文件类型
   - `small-doc.pdf` (1MB) ✅
3. 点击上传

**预期结果**：
- 成功提示：`成功上传 1 个文件`
- 错误提示1：`存储空间不足，已停止上传。存储空间不足。可用: 100.00 MB, 需要: 200.00 MB`
- 错误提示2：`malware.exe: 不允许上传 .exe 类型的文件（安全限制）`

## 错误提示对比

### 修改前

**问题**：
- 只显示"X 个文件上传失败"
- 用户不知道具体是哪个文件失败
- 用户不知道失败的原因

**示例**：
```
❌ 2 个文件上传失败
```

### 修改后

**改进**：
- 显示每个失败文件的名称
- 显示具体的错误原因
- 用户可以针对性地解决问题

**示例**：
```
✅ 成功上传 3 个文件
❌ malware.exe: 不允许上传 .exe 类型的文件（安全限制）
❌ script.bat: 不允许上传 .bat 类型的文件（安全限制）
```

## 支持的错误类型

### 1. 文件类型错误 (APF603)
```
test.exe: 不允许上传 .exe 类型的文件（安全限制）
```

### 2. 存储配额错误 (APF903)
```
存储空间不足。可用: 102.40 MB, 需要: 297.48 MB
```

### 3. 文件已存在
```
⚠️ 2 个文件已存在
```

### 4. 其他错误
```
document.pdf: 文件上传失败
```

## 前端代码改进

### 分片上传错误处理

```javascript
// 显示具体的错误信息
if (errorCount > 0) {
  const errorFiles = results.filter(r => !r.success)
  errorFiles.forEach(file => {
    if (file.code !== 'APF903') { // 配额错误已经在上面显示
      message.error(`${file.fileName}: ${file.error}`)
    }
  })
}
```

### 普通上传错误处理

```javascript
if (errorFiles.length > 0) {
  // 显示每个失败文件的具体错误信息
  errorFiles.forEach(file => {
    message.error(`${file.filename}: ${file.error}`)
  })
}
```

## 用户体验提升

### 1. 清晰的错误信息
- ✅ 用户知道哪个文件失败了
- ✅ 用户知道为什么失败
- ✅ 用户可以采取相应的行动

### 2. 批量上传友好
- ✅ 成功的文件正常上传
- ✅ 失败的文件单独提示
- ✅ 不会因为一个文件失败而影响其他文件

### 3. 安全提示
- ✅ 明确告知用户文件类型限制
- ✅ 提供安全原因说明
- ✅ 防止用户误操作

## 测试清单

- [ ] 上传单个 `.exe` 文件 → 显示具体错误
- [ ] 上传多个文件（包含 `.exe`）→ 显示每个错误文件的信息
- [ ] 分片上传 `.exe` 文件 → 初始化阶段被拒绝
- [ ] 上传正常文件 → 成功上传
- [ ] 混合场景（成功+失败）→ 分别显示成功和失败信息
- [ ] 存储配额不足 → 显示配额错误
- [ ] 文件已存在 → 显示警告信息
