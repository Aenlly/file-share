# 问题修复总结

## 1. Config导入问题修复

### 问题
```
Cannot read properties of undefined (reading 'database')
```

### 原因
- `cleanExpiredTrashFiles`函数在路由文件加载时就执行
- 此时DatabaseManager还未初始化
- 导致访问数据库失败

### 解决方案
将自动清理任务移到app.js中，在数据库初始化后再启动：

```javascript
// app.js
// 启动回收站自动清理任务（数据库初始化后）
const { cleanExpiredTrashFiles } = require('./routes/folderRoutes');
if (cleanExpiredTrashFiles) {
    setInterval(cleanExpiredTrashFiles, 24 * 60 * 60 * 1000);
    cleanExpiredTrashFiles().catch(err => {
        logger.error('首次清理回收站失败:', err);
    });
}
```

## 2. 回收站文件不显示问题

### 问题
删除文件后，回收站中看不到已删除的文件

### 原因
JSON数据库适配器不支持`$ne`操作符，导致查询过滤失败

### 解决方案
改用手动过滤：

```javascript
// 修改前
async findByFolder(folderId, includeDeleted = false) {
    const query = { folderId };
    if (!includeDeleted) {
        query.isDeleted = { $ne: true };  // 不支持
    }
    const files = await this.find(query);
    return files;
}

// 修改后
async findByFolder(folderId, includeDeleted = false) {
    let files = await this.find({ folderId });
    
    // 手动过滤已删除的文件
    if (!includeDeleted) {
        files = files.filter(file => !file.isDeleted);
    }
    
    return files;
}
```

## 3. 大文件上传提示

### 问题
上传大文件时直接报错，没有提示用户使用分片上传

### 解决方案
在上传前检查文件大小，超过200MB时提示用户：

```javascript
const handleUpload = async () => {
    // 检查是否有大文件（>200MB）
    const largeFiles = fileList.filter(file => file.size > 200 * 1024 * 1024)
    
    if (largeFiles.length > 0 && !useChunkUpload) {
        Modal.confirm({
            title: '检测到大文件',
            content: `有 ${largeFiles.length} 个文件超过200MB，建议使用分片上传。是否启用分片上传？`,
            okText: '启用分片上传',
            cancelText: '继续普通上传',
            onOk: () => {
                setUseChunkUpload(true)
                message.info('已启用分片上传，请重新点击上传按钮')
            }
        })
        return
    }
    
    // 继续上传...
}
```

## 修改文件列表

### 后端
- `backend/src/app.js` - 移动自动清理任务到初始化后
- `backend/src/routes/folderRoutes.js` - 导出清理函数
- `backend/src/models/FileModel.js` - 改用手动过滤
- `backend/src/database/DatabaseManager.js` - 添加config验证

### 前端
- `frontend/src/components/FolderDetail/FileUploadCard.jsx` - 添加大文件检测

## 测试建议

### 1. 回收站测试
- [ ] 删除文件
- [ ] 查看回收站
- [ ] 验证文件显示
- [ ] 恢复文件
- [ ] 永久删除

### 2. 大文件上传测试
- [ ] 上传小文件（<200MB）- 正常上传
- [ ] 上传大文件（>200MB）- 提示分片上传
- [ ] 启用分片上传
- [ ] 验证上传成功

### 3. 自动清理测试
- [ ] 服务启动
- [ ] 验证清理任务启动
- [ ] 查看日志

## 需要重启
✅ 后端需要重启
✅ 前端需要重新编译

## 状态
✅ Config导入问题已修复
✅ 回收站显示问题已修复
✅ 大文件上传提示已添加
✅ 自动清理任务已优化
