# 文件哈希重复检测功能

## 概述

系统现在使用 MD5 哈希值来检测重复文件，这比仅比对文件名更准确。

## 功能特性

### 1. 哈希计算
- 上传文件时自动计算 MD5 哈希值
- 哈希值存储在数据库中
- 用于精确识别文件内容

### 2. 重复检测逻辑

系统使用三层检测机制：

#### 第一层：哈希匹配（最准确）
- 比对文件的 MD5 哈希值
- 即使文件名不同，只要内容相同就会被识别为重复
- 示例：`photo.jpg` 和 `image.jpg` 如果内容相同，会被检测为重复

#### 第二层：文件名匹配
- 检查同一文件夹中是否有同名文件
- 如果同名但哈希不同，允许上传（内容不同）
- 如果同名且哈希相同，标记为重复

#### 第三层：兼容性检查
- 对于没有哈希值的旧文件（升级前上传的）
- 使用文件名 + 文件大小进行比对
- 确保向后兼容

### 3. 重复文件处理

当检测到重复文件时：
- 返回 409 状态码
- 提供详细的重复信息：
  - `filename`: 当前文件名
  - `size`: 文件大小
  - `hash`: 文件哈希值
  - `existingFile`: 已存在的文件名
  - `existingId`: 已存在文件的 ID
  - `reason`: 重复原因（hash_match, name_match, name_and_size_match）

用户可以选择：
- 取消上传
- 强制上传（覆盖）

## 使用场景

### 场景 1：完全相同的文件
```
上传: photo.jpg (1MB, hash: abc123)
已存在: photo.jpg (1MB, hash: abc123)
结果: ❌ 重复（哈希相同）
```

### 场景 2：同名但内容不同
```
上传: photo.jpg (1.2MB, hash: def456)
已存在: photo.jpg (1MB, hash: abc123)
结果: ✅ 允许上传（内容不同）
```

### 场景 3：不同名但内容相同
```
上传: image.jpg (1MB, hash: abc123)
已存在: photo.jpg (1MB, hash: abc123)
结果: ❌ 重复（哈希相同）
```

### 场景 4：修改后的文件
```
上传: photo_edited.jpg (1.1MB, hash: ghi789)
已存在: photo.jpg (1MB, hash: abc123)
结果: ✅ 允许上传（哈希不同）
```

## 数据迁移

### 为现有文件添加哈希值

如果你在添加此功能前已经有文件，需要运行迁移脚本：

```bash
cd backend
node scripts/add-file-hashes.js
```

脚本会：
1. 扫描所有文件记录
2. 读取物理文件
3. 计算 MD5 哈希值
4. 更新数据库记录

### 迁移输出示例

```
开始为现有文件添加哈希值...

找到 150 个文件记录

[1/150] ✓ 已更新: photo1.jpg -> a1b2c3d4e5f6...
[2/150] 跳过（已有哈希）: photo2.jpg
[3/150] ✓ 已更新: document.pdf -> f6e5d4c3b2a1...
...

=== 完成 ===
总计: 150 个文件
已更新: 145 个
已跳过: 3 个
错误: 2 个
```

## 性能考虑

### 哈希计算性能
- MD5 计算速度快
- 对于 100MB 文件，计算时间 < 1秒
- 在内存中计算（文件已在 buffer 中）

### 数据库查询
- 添加了 `hash` 字段索引（如果使用 SQL 数据库）
- 查询速度快

### 存储开销
- MD5 哈希值：32 字符（十六进制）
- 每个文件增加约 50 字节存储

## API 变化

### 上传响应（检测到重复）

```json
{
  "success": false,
  "uploadedFiles": [],
  "existingFiles": [
    {
      "filename": "photo.jpg",
      "size": 1048576,
      "hash": "a1b2c3d4e5f6...",
      "existingFile": "image.jpg",
      "existingId": 123,
      "reason": "hash_match"
    }
  ],
  "errorFiles": [],
  "total": 1
}
```

### 强制上传

前端可以设置 `force=true` 参数来强制上传：

```javascript
formData.append('force', 'true');
```

## 配置选项

目前使用 MD5 算法，如需更改：

1. 修改 `calculateFileHash` 函数
2. 可选算法：
   - `md5`: 快速，适合大多数场景
   - `sha1`: 更安全
   - `sha256`: 最安全，但较慢

```javascript
// 使用 SHA256
function calculateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}
```

## 注意事项

1. **哈希冲突**：MD5 理论上可能冲突，但实际概率极低
2. **大文件**：100MB+ 文件计算哈希可能需要几秒钟
3. **内存使用**：文件在内存中（multer memoryStorage），注意内存限制
4. **向后兼容**：旧文件没有哈希值时，使用文件名+大小比对

## 未来改进

1. 支持分片上传时的增量哈希计算
2. 添加哈希算法配置选项
3. 支持跨文件夹的重复检测
4. 文件去重建议（相同内容的文件只存储一份）
