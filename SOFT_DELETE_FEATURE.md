# 文件软删除功能

## 功能说明
实现了文件的物理删除和逻辑删除两种方式，用户可以选择：
- **物理删除**：永久删除文件（删除数据库记录和物理文件）
- **逻辑删除**：保留文件但添加删除标记（在文件名后添加后缀）

## 实现内容

### 后端实现

#### 1. FileModel 新增方法
**文件**: `backend/src/models/FileModel.js`

##### 软删除（逻辑删除）
```javascript
async softDelete(id, owner) {
    const file = await this.findById(id);
    
    if (!file || file.owner !== owner) {
        throw new Error('无权删除');
    }

    // 添加删除标记后缀
    const deletedTime = new Date().toISOString().replace(/[:.]/g, '-');
    const newOriginalName = `${file.originalName}.deleted_${deletedTime}`;
    
    return await this.update(id, {
        originalName: newOriginalName,
        isDeleted: true,
        deletedAt: new Date().toISOString()
    });
}
```

**特点**:
- 在文件名后添加 `.deleted_时间戳` 后缀
- 标记 `isDeleted: true`
- 记录删除时间 `deletedAt`
- 不删除物理文件

##### 物理删除（硬删除）
```javascript
async hardDelete(id, owner) {
    const file = await this.findById(id);
    
    if (!file || file.owner !== owner) {
        throw new Error('无权删除');
    }

    return await super.delete(id);
}
```

**特点**:
- 删除数据库记录
- 需要配合路由删除物理文件

##### 批量删除
```javascript
async batchDelete(filenames, folderId, owner, options = {}) {
    const { physicalDelete = true } = options;
    
    // 根据 physicalDelete 参数选择删除方式
    if (physicalDelete) {
        await this.hardDelete(id, owner);
    } else {
        await this.softDelete(id, owner);
    }
}
```

#### 2. 路由修改
**文件**: `backend/src/routes/folderRoutes.js`

```javascript
router.delete('/:folderId/file', authenticate, async (req, res, next) => {
    const { filenames, filename, physicalDelete = false } = req.body;
    
    // 调用批量删除，传入 physicalDelete 参数
    const result = await FileModel.batchDelete(
        filesToDelete, 
        folderId, 
        req.user.username,
        { physicalDelete }
    );

    // 只有物理删除时才删除物理文件
    if (physicalDelete) {
        for (const file of result.deletedFiles) {
            const filePath = path.join(dirPath, file.savedName);
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
            }
        }
    }
    
    // 返回删除类型
    res.json({
        success: result.deletedFiles.length > 0,
        deletedFiles: result.deletedFiles,
        errorFiles: result.errorFiles,
        total: filesToDelete.length,
        deleteType: physicalDelete ? 'physical' : 'logical'
    });
});
```

### 前端实现

#### FileListCard 组件修改
**文件**: `frontend/src/components/FolderDetail/FileListCard.jsx`

##### 1. 修改删除 mutation
```javascript
const deleteFileMutation = useMutation(
    async ({ files, physicalDelete }) => {
        const fileArray = Array.isArray(files) ? files : [files]
        const filenames = fileArray.map(f => f.savedName)
        
        const response = await api.delete(`/folders/${folderId}/file`, { 
            data: { filenames, physicalDelete } 
        })
        
        return response.data
    }
)
```

##### 2. 添加删除类型提示
```javascript
onSuccess: (data) => {
    const { deletedFiles, errorFiles, deleteType } = data
    const deleteTypeText = deleteType === 'physical' ? '物理删除' : '逻辑删除'
    
    if (deletedFiles.length > 0) {
        message.success(`成功${deleteTypeText} ${deletedFiles.length} 个文件`)
    }
}
```

##### 3. 修改删除确认框
```javascript
Modal.confirm({
    title: '删除确认',
    content: (
        <div>
            <p>确定要删除文件 "{record.name}" 吗？</p>
            <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
                提示：物理删除将永久删除文件，逻辑删除将在文件名后添加删除标记
            </p>
        </div>
    ),
    okText: '物理删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: () => {
        deleteFileMutation.mutate({ files: record, physicalDelete: true })
    },
    footer: (_, { OkBtn, CancelBtn }) => (
        <>
            <Button onClick={() => {
                Modal.destroyAll()
                deleteFileMutation.mutate({ files: record, physicalDelete: false })
            }}>
                逻辑删除
            </Button>
            <CancelBtn />
            <OkBtn />
        </>
    ),
})
```

## 使用说明

### 单个文件删除
1. 点击文件列表中的"删除"按钮
2. 弹出确认框，显示三个选项：
   - **逻辑删除**（左侧按钮）：在文件名后添加删除标记
   - **取消**（中间按钮）：取消删除操作
   - **物理删除**（右侧红色按钮）：永久删除文件

### 批量删除
1. 选择多个文件（桌面端）
2. 点击"批量删除"按钮
3. 弹出确认框，显示三个选项（同上）

## 删除效果

### 物理删除
- ✅ 删除数据库记录
- ✅ 删除物理文件
- ✅ 文件彻底消失
- ❌ 无法恢复

### 逻辑删除
- ✅ 保留数据库记录
- ✅ 保留物理文件
- ✅ 文件名添加后缀
- ✅ 可以恢复（通过重命名）

**文件名示例**:
```
原文件名: photo.jpg
逻辑删除后: photo.jpg.deleted_2024-12-03T10-30-45-123Z
```

## API 接口

### DELETE /api/folders/:folderId/file

**请求体**:
```json
{
  "filenames": ["file1.jpg", "file2.pdf"],
  "physicalDelete": false
}
```

**参数说明**:
- `filenames`: 要删除的文件名数组（savedName）
- `filename`: 单个文件名（兼容旧版本）
- `physicalDelete`: 是否物理删除
  - `true`: 物理删除（永久删除）
  - `false`: 逻辑删除（默认值）

**响应**:
```json
{
  "success": true,
  "deletedFiles": [
    {
      "originalName": "photo.jpg",
      "savedName": "1234567890_photo.jpg",
      "deleteType": "logical"
    }
  ],
  "errorFiles": [],
  "total": 1,
  "deleteType": "logical"
}
```

## 数据库字段

逻辑删除会更新以下字段：
- `originalName`: 添加 `.deleted_时间戳` 后缀
- `isDeleted`: 设置为 `true`
- `deletedAt`: 记录删除时间

## 优势

### 1. 数据安全
- 防止误删除
- 可以恢复文件
- 保留删除记录

### 2. 灵活性
- 用户可以选择删除方式
- 管理员可以查看已删除文件
- 可以实现回收站功能

### 3. 审计追踪
- 记录删除时间
- 保留文件历史
- 便于问题排查

## 注意事项

### 1. 文件名冲突
逻辑删除后的文件名包含时间戳，避免了重名问题：
```
photo.jpg.deleted_2024-12-03T10-30-45-123Z
photo.jpg.deleted_2024-12-03T10-31-20-456Z
```

### 2. 存储空间
- 逻辑删除不释放存储空间
- 需要定期清理已删除文件
- 建议实现自动清理机制

### 3. 文件列表显示
✅ 已实现：逻辑删除的文件不会显示在正常列表中

**查询逻辑**:
```javascript
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

**回收站查询**:
```javascript
async findDeletedByFolder(folderId) {
    const files = await this.find({ 
        folderId, 
        isDeleted: true 
    });
    return files;
}
```

## 未来改进

### 1. 回收站功能
```javascript
// 添加回收站视图
router.get('/:folderId/trash', authenticate, async (req, res) => {
    const deletedFiles = await FileModel.find({ 
        folderId, 
        isDeleted: true 
    });
    res.json(deletedFiles);
});
```

### 2. 恢复功能
```javascript
// 恢复已删除文件
router.post('/:folderId/file/:fileId/restore', authenticate, async (req, res) => {
    const file = await FileModel.findById(fileId);
    const originalName = file.originalName.replace(/\.deleted_.*$/, '');
    
    await FileModel.update(fileId, {
        originalName,
        isDeleted: false,
        deletedAt: null
    });
    
    res.json({ success: true });
});
```

### 3. 自动清理
```javascript
// 定期清理超过30天的已删除文件
setInterval(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldDeletedFiles = await FileModel.find({
        isDeleted: true,
        deletedAt: { $lt: thirtyDaysAgo.toISOString() }
    });
    
    for (const file of oldDeletedFiles) {
        await FileModel.hardDelete(file.id, file.owner);
        // 删除物理文件
    }
}, 24 * 60 * 60 * 1000); // 每天执行一次
```

## 测试建议

### 1. 单个文件逻辑删除
- 删除文件
- 验证文件名添加后缀
- 验证文件仍在列表中
- 验证物理文件仍存在

### 2. 单个文件物理删除
- 删除文件
- 验证文件从列表消失
- 验证物理文件被删除

### 3. 批量删除
- 选择多个文件
- 测试逻辑删除
- 测试物理删除
- 验证部分成功的情况

### 4. 权限测试
- 测试删除其他用户的文件
- 验证权限检查

## 修改文件列表
- `backend/src/models/FileModel.js` - 添加软删除和硬删除方法
- `backend/src/routes/folderRoutes.js` - 修改删除路由支持删除选项
- `frontend/src/components/FolderDetail/FileListCard.jsx` - 添加删除选项UI

## 需要重启
✅ 后端需要重启
✅ 前端需要重新编译

## 状态
✅ 后端软删除功能已实现
✅ 后端硬删除功能已实现
✅ 前端删除选项UI已实现
✅ 批量删除支持
✅ 单个删除支持
✅ 查询时过滤已删除文件
✅ 回收站查询方法已实现
⏳ 回收站UI（待实现）
⏳ 恢复功能（待实现）
⏳ 自动清理功能（待实现）
