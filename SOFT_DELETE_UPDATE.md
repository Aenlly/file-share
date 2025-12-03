# 软删除功能更新

## 问题
逻辑删除的文件仍然显示在文件列表中

## 解决方案
修改查询逻辑，默认过滤掉已删除的文件

## 修改内容

### FileModel.findByFolder() 方法
**文件**: `backend/src/models/FileModel.js`

```javascript
// 修改前
async findByFolder(folderId) {
    const files = await this.find({ folderId });
    return files;
}

// 修改后
async findByFolder(folderId, includeDeleted = false) {
    const query = { folderId };
    
    // 默认不包含已删除的文件
    if (!includeDeleted) {
        query.isDeleted = { $ne: true };
    }
    
    const files = await this.find(query);
    return files;
}
```

### 新增回收站查询方法
```javascript
async findDeletedByFolder(folderId) {
    const files = await this.find({ 
        folderId, 
        isDeleted: true 
    });
    return files;
}
```

## 效果

### 正常文件列表
- ✅ 只显示未删除的文件
- ✅ 逻辑删除的文件被隐藏
- ✅ 物理删除的文件已被删除

### 回收站（待实现UI）
- ✅ 可以查询已删除的文件
- ⏳ 需要添加回收站UI
- ⏳ 需要添加恢复功能

## 使用示例

### 查询正常文件
```javascript
// 默认不包含已删除文件
const files = await FileModel.findByFolder(folderId);

// 或明确指定
const files = await FileModel.findByFolder(folderId, false);
```

### 查询所有文件（包含已删除）
```javascript
const allFiles = await FileModel.findByFolder(folderId, true);
```

### 只查询已删除文件（回收站）
```javascript
const deletedFiles = await FileModel.findDeletedByFolder(folderId);
```

## 数据库查询

### 正常查询
```javascript
{
  folderId: 123,
  isDeleted: { $ne: true }  // 不等于 true
}
```

### 回收站查询
```javascript
{
  folderId: 123,
  isDeleted: true
}
```

## 兼容性
- ✅ 向后兼容
- ✅ 默认行为：不显示已删除文件
- ✅ 可选参数：可以查询所有文件

## 需要重启
✅ 后端需要重启以应用查询逻辑修改

## 测试建议

### 1. 逻辑删除后查询
```bash
# 1. 逻辑删除一个文件
# 2. 刷新文件列表
# 3. 验证文件不再显示
```

### 2. 物理删除后查询
```bash
# 1. 物理删除一个文件
# 2. 刷新文件列表
# 3. 验证文件不再显示
```

### 3. 回收站查询
```bash
# 1. 逻辑删除几个文件
# 2. 调用回收站查询API
# 3. 验证只返回已删除文件
```

## 下一步计划

### 1. 回收站UI
添加回收站页面或标签页：
- 显示已删除文件列表
- 显示删除时间
- 提供恢复按钮
- 提供永久删除按钮

### 2. 恢复功能
```javascript
router.post('/:folderId/file/:fileId/restore', authenticate, async (req, res) => {
    const file = await FileModel.findById(fileId);
    
    // 移除删除标记后缀
    const originalName = file.originalName.replace(/\.deleted_.*$/, '');
    
    await FileModel.update(fileId, {
        originalName,
        isDeleted: false,
        deletedAt: null
    });
    
    res.json({ success: true, message: '文件已恢复' });
});
```

### 3. 自动清理
定期清理超过30天的已删除文件：
```javascript
// 每天执行一次
setInterval(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const oldDeletedFiles = await FileModel.find({
        isDeleted: true,
        deletedAt: { $lt: thirtyDaysAgo.toISOString() }
    });
    
    for (const file of oldDeletedFiles) {
        // 物理删除
        await FileModel.hardDelete(file.id, file.owner);
        // 删除物理文件
        await fs.remove(filePath);
    }
}, 24 * 60 * 60 * 1000);
```

## 修改文件
- `backend/src/models/FileModel.js` - 修改查询逻辑，添加回收站查询

## 状态
✅ 查询逻辑已修改
✅ 已删除文件不再显示
✅ 回收站查询方法已添加
⏳ 回收站UI待实现
⏳ 恢复功能待实现
