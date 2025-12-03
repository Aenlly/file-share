# 回收站重构 - 独立表设计

## 重构说明
将逻辑删除的文件从files表移动到独立的recycleBin表，实现更清晰的数据分离。

## 设计优势

### 之前的设计（标记删除）
```
files表:
- id
- name
- isDeleted: true/false  ❌ 混在一起
- deletedAt
```

**问题**:
- 文件表混杂了正常文件和已删除文件
- 查询时需要过滤isDeleted字段
- 数据不够清晰

### 现在的设计（独立表）
```
files表:
- id
- name
- ...（只包含正常文件）

recycleBin表:
- id
- originalFileId
- name
- deletedAt
- ...（只包含已删除文件）
```

**优势**:
- ✅ 数据分离清晰
- ✅ 查询更简单（无需过滤）
- ✅ 回收站独立管理
- ✅ 性能更好

## 实现内容

### 1. 新增RecycleBinModel
**文件**: `backend/src/models/RecycleBinModel.js`

**核心方法**:
```javascript
// 移至回收站
async moveToRecycleBin(fileRecord)

// 查询用户回收站
async findByOwner(owner)

// 查询过期文件
async findExpired(beforeDate)

// 恢复文件
async restore(recycleBinId)

// 永久删除
async permanentDelete(recycleBinId, owner)

// 清空回收站
async clearByOwner(owner)
```

### 2. 简化FileModel
**文件**: `backend/src/models/FileModel.js`

**移除的方法**:
- ~~`softDelete()`~~ - 不再需要
- ~~`hardDelete()`~~ - 简化为delete()
- ~~`findDeletedByFolder()`~~ - 移至RecycleBinModel
- ~~`findDeletedByOwner()`~~ - 移至RecycleBinModel
- ~~`findExpiredDeleted()`~~ - 移至RecycleBinModel

**新增/修改的方法**:
```javascript
// 批量移至回收站
async batchMoveToRecycleBin(filenames, folderId, owner) {
    // 1. 移至回收站表
    await RecycleBinModel.moveToRecycleBin(file);
    // 2. 从文件表删除
    await super.delete(file.id);
}

// 简化查询（不再需要过滤）
async findByFolder(folderId) {
    // 直接查询，不需要过滤isDeleted
    return await this.find({ folderId });
}
```

### 3. 更新路由
**文件**: `backend/src/routes/folderRoutes.js`

#### 删除文件（移至回收站）
```javascript
router.delete('/:folderId/file', async (req, res) => {
    // 移至回收站（不删除物理文件）
    const result = await FileModel.batchMoveToRecycleBin(
        filesToDelete, 
        folderId, 
        req.user.username
    );
});
```

#### 获取回收站列表
```javascript
router.get('/trash/files', async (req, res) => {
    const RecycleBinModel = require('../models/RecycleBinModel');
    const deletedFiles = await RecycleBinModel.findByOwner(username);
});
```

#### 恢复文件
```javascript
router.post('/trash/restore/:fileId', async (req, res) => {
    const RecycleBinModel = require('../models/RecycleBinModel');
    
    // 1. 从回收站恢复
    const restoredFile = await RecycleBinModel.restore(recycleBinId);
    
    // 2. 重新添加到文件表
    const newFile = await FileModel.create(restoredFile);
});
```

#### 永久删除
```javascript
router.delete('/trash/:fileId', async (req, res) => {
    const RecycleBinModel = require('../models/RecycleBinModel');
    
    // 1. 删除物理文件
    await fs.remove(filePath);
    
    // 2. 从回收站删除记录
    await RecycleBinModel.permanentDelete(recycleBinId, username);
});
```

#### 清空回收站
```javascript
router.delete('/trash/clear', async (req, res) => {
    const RecycleBinModel = require('../models/RecycleBinModel');
    const recycleBinFiles = await RecycleBinModel.findByOwner(username);
    
    for (const file of recycleBinFiles) {
        // 删除物理文件
        await fs.remove(filePath);
        // 从回收站删除
        await RecycleBinModel.permanentDelete(file.id, username);
    }
});
```

#### 自动清理
```javascript
async function cleanExpiredTrashFiles() {
    const RecycleBinModel = require('../models/RecycleBinModel');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const expiredFiles = await RecycleBinModel.findExpired(thirtyDaysAgo.toISOString());
    
    for (const file of expiredFiles) {
        // 删除物理文件
        await fs.remove(filePath);
        // 从回收站删除
        await RecycleBinModel.permanentDelete(file.id, file.owner);
    }
}
```

## 数据流程

### 删除文件流程
```
1. 用户点击删除
   ↓
2. 从files表读取文件记录
   ↓
3. 复制到recycleBin表
   ↓
4. 从files表删除记录
   ↓
5. 物理文件保留
```

### 恢复文件流程
```
1. 用户点击恢复
   ↓
2. 从recycleBin表读取记录
   ↓
3. 重新插入files表
   ↓
4. 从recycleBin表删除
   ↓
5. 文件恢复完成
```

### 永久删除流程
```
1. 用户点击永久删除
   ↓
2. 从recycleBin表读取记录
   ↓
3. 删除物理文件
   ↓
4. 从recycleBin表删除记录
   ↓
5. 文件彻底删除
```

## 数据库表结构

### files表（正常文件）
```json
{
  "id": 1,
  "folderId": 10,
  "originalName": "photo.jpg",
  "savedName": "1234567890_photo.jpg",
  "size": 1048576,
  "owner": "user1",
  "uploadTime": "2024-12-03T10:00:00.000Z"
}
```

### recycleBin表（已删除文件）
```json
{
  "id": 1,
  "originalFileId": 1,
  "folderId": 10,
  "originalName": "photo.jpg",
  "savedName": "1234567890_photo.jpg",
  "size": 1048576,
  "owner": "user1",
  "uploadTime": "2024-12-03T10:00:00.000Z",
  "deletedAt": "2024-12-03T15:30:00.000Z"
}
```

## 优势对比

| 特性 | 标记删除 | 独立表 |
|------|---------|--------|
| 数据分离 | ❌ 混在一起 | ✅ 清晰分离 |
| 查询性能 | ❌ 需要过滤 | ✅ 直接查询 |
| 代码复杂度 | ❌ 需要判断 | ✅ 逻辑简单 |
| 数据管理 | ❌ 不够清晰 | ✅ 独立管理 |
| 扩展性 | ❌ 受限 | ✅ 灵活 |

## 修改文件列表

### 新增
- `backend/src/models/RecycleBinModel.js` - 回收站模型

### 修改
- `backend/src/models/FileModel.js` - 简化删除逻辑
- `backend/src/routes/folderRoutes.js` - 更新所有回收站相关路由

### 前端
- 无需修改（API接口保持兼容）

## 迁移建议

如果已有数据使用标记删除，需要迁移：

```javascript
// 迁移脚本
async function migrateToRecycleBin() {
    const FileModel = require('./models/FileModel');
    const RecycleBinModel = require('./models/RecycleBinModel');
    
    // 查找所有标记为删除的文件
    const deletedFiles = await FileModel.find({ isDeleted: true });
    
    for (const file of deletedFiles) {
        // 移至回收站
        await RecycleBinModel.moveToRecycleBin(file);
        
        // 从文件表删除
        await FileModel.delete(file.id);
    }
    
    console.log(`迁移完成: ${deletedFiles.length} 个文件`);
}
```

## 测试建议

### 1. 删除文件测试
- [ ] 删除文件
- [ ] 验证文件从files表消失
- [ ] 验证文件出现在recycleBin表
- [ ] 验证物理文件仍存在

### 2. 回收站查询测试
- [ ] 查看回收站
- [ ] 验证只显示自己的文件
- [ ] 验证文件信息完整

### 3. 恢复文件测试
- [ ] 恢复文件
- [ ] 验证文件回到files表
- [ ] 验证文件从recycleBin表消失
- [ ] 验证文件可正常使用

### 4. 永久删除测试
- [ ] 永久删除文件
- [ ] 验证物理文件被删除
- [ ] 验证recycleBin表记录删除

### 5. 清空回收站测试
- [ ] 清空回收站
- [ ] 验证所有文件被删除
- [ ] 验证recycleBin表为空

## 需要重启
✅ 后端需要重启（新增Model和修改路由）
❌ 前端无需修改（API兼容）

## 状态
✅ RecycleBinModel已创建
✅ FileModel已简化
✅ 所有路由已更新
✅ 自动清理已更新
✅ 数据分离已实现
✅ 代码已验证无错误

## 版本信息
- **重构日期**: 2024年12月3日
- **设计模式**: 独立表设计
- **向后兼容**: API接口保持兼容
