# 回收站层级还原修复

## 修改日期
2024-12-04

## 问题描述

### 原始问题
在还原子文件夹时，子文件夹变成了父文件夹，丢失了层级关系。

### 根本原因
1. **删除时记录不完整**：只记录了父文件夹的 ID，没有记录父文件夹的详细信息
2. **还原时查找失败**：当父文件夹也被删除时，通过 ID 无法找到父文件夹
3. **层级关系丢失**：无法重建正确的文件夹层级结构

### 示例场景
```
文件夹A
  └── 子文件夹B
        └── 文件1.txt
```

**删除顺序：**
1. 删除子文件夹B
2. 删除文件夹A

**还原问题：**
- 还原子文件夹B → 变成了根文件夹（parentId = null）
- 应该是：子文件夹B → 父文件夹是A

## 解决方案

### 1. 增强删除时的信息记录

#### 修改 `RecycleBinModel.moveFolderToRecycleBin()`
添加父文件夹的详细信息记录：

```javascript
// 新增字段
parentFolderAlias: '父文件夹名称',
parentFolderPhysicalPath: '父文件夹物理路径'
```

**记录的完整信息：**
- `folderParentId`: 父文件夹ID（可能失效）
- `parentFolderAlias`: 父文件夹名称（用于显示）
- `parentFolderPhysicalPath`: 父文件夹物理路径（用于查找）

#### 修改 `folderRoutes.js` 删除逻辑
在删除文件夹时，获取并传递父文件夹信息：

```javascript
// 获取父文件夹信息
let parentFolder = null;
if (folder.parentId) {
    parentFolder = await FolderModel.findById(folder.parentId);
}

// 传递给回收站
await RecycleBinModel.moveFolderToRecycleBin(folder, files, parentFolder);
```

### 2. 智能父文件夹查找和创建

#### 新增 `findOrCreateParentFolder()` 函数
递归查找或创建父文件夹：

```javascript
async function findOrCreateParentFolder(folderInfo, owner) {
    // 1. 通过父文件夹ID查找
    if (folderInfo.folderParentId) {
        const parent = await FolderModel.findById(folderInfo.folderParentId);
        if (parent) return parent.id;
    }
    
    // 2. 通过父文件夹物理路径查找
    if (folderInfo.parentFolderPhysicalPath) {
        const parent = findByPhysicalPath(folderInfo.parentFolderPhysicalPath);
        if (parent) return parent.id;
    }
    
    // 3. 父文件夹不存在，从回收站查找并递归创建
    const parentRecycle = findInRecycleBin(folderInfo.parentFolderPhysicalPath);
    if (parentRecycle) {
        // 递归创建祖父文件夹
        const grandParentId = await findOrCreateParentFolder(parentRecycle, owner);
        // 创建父文件夹
        const parent = await FolderModel.create({
            alias: parentRecycle.folderAlias,
            owner,
            parentId: grandParentId
        });
        return parent.id;
    }
    
    return null;
}
```

#### 修改 `findOrCreateFolder()` 函数
使用新的父文件夹查找逻辑：

```javascript
async function findOrCreateFolder(folderInfo, owner) {
    // 查找现有文件夹
    const existing = findExistingFolder(folderInfo);
    if (existing) return { folder: existing, isNew: false };
    
    // 递归创建父文件夹
    const parentFolderId = await findOrCreateParentFolder(folderInfo, owner);
    
    // 创建文件夹
    const newFolder = await FolderModel.create({
        alias: folderInfo.folderAlias,
        owner,
        parentId: parentFolderId  // 正确的父文件夹ID
    });
    
    return { folder: newFolder, isNew: true };
}
```

### 3. 修改还原逻辑

#### 还原文件夹
```javascript
// 使用递归查找或创建父文件夹
const parentFolderId = await findOrCreateParentFolder(folder, folder.owner);

const newFolder = await FolderModel.create({
    alias: folder.folderAlias,
    owner: folder.owner,
    parentId: parentFolderId  // 正确的层级关系
});
```

#### 还原文件
```javascript
// 使用 findOrCreateFolder 自动处理层级
const result = await findOrCreateFolder(folderInfo, owner);
targetFolder = result.folder;
```

## 修复效果

### 场景1：子文件夹先还原
```
删除：文件夹A → 子文件夹B
还原：子文件夹B → 文件夹A

结果：
文件夹A (自动创建)
  └── 子文件夹B (正确还原)
```

### 场景2：父文件夹先还原
```
删除：文件夹A → 子文件夹B
还原：文件夹A → 子文件夹B

结果：
文件夹A (还原)
  └── 子文件夹B (还原到正确位置)
```

### 场景3：多层级结构
```
删除：文件夹A → 子文件夹B → 孙文件夹C
还原：孙文件夹C

结果：
文件夹A (自动创建)
  └── 子文件夹B (自动创建)
        └── 孙文件夹C (正确还原)
```

### 场景4：父文件夹已存在
```
删除：文件夹A → 子文件夹B
还原：子文件夹B (文件夹A已存在)

结果：
文件夹A (现有)
  └── 子文件夹B (还原到现有文件夹下)
```

## 查找优先级

### 父文件夹查找顺序
1. **通过ID查找** - 最快，但可能失效
2. **通过物理路径查找** - 可靠，即使ID变化
3. **从回收站查找** - 父文件夹也被删除的情况
4. **递归创建** - 重建完整层级结构

### 文件夹查找顺序
1. **通过原始ID查找**
2. **通过物理路径查找**
3. **创建新文件夹**（使用正确的父文件夹ID）

## 修改的文件

### 1. backend/src/models/RecycleBinModel.js
- 修改 `moveFolderToRecycleBin()` 方法签名
- 添加 `parentFolder` 参数
- 记录 `parentFolderAlias` 和 `parentFolderPhysicalPath`

### 2. backend/src/routes/folderRoutes.js
- 删除文件夹时获取父文件夹信息
- 传递父文件夹给 `moveFolderToRecycleBin()`

### 3. backend/src/routes/recycleBinRoutes.js
- 添加 `findOrCreateParentFolder()` 函数
- 修改 `findOrCreateFolder()` 函数
- 更新文件夹还原逻辑
- 更新文件还原逻辑

## 数据兼容性

### 旧数据处理
- 旧的回收站记录没有 `parentFolderAlias` 和 `parentFolderPhysicalPath`
- 系统会尝试通过 `folderParentId` 查找
- 如果找不到，创建为根文件夹（向后兼容）

### 新数据优势
- 完整的层级信息
- 支持递归重建
- 更可靠的还原

## 测试建议

### 测试用例1：简单层级
```
1. 创建：文件夹A → 子文件夹B
2. 删除：子文件夹B → 文件夹A
3. 还原：子文件夹B
4. 验证：子文件夹B 在文件夹A 下
```

### 测试用例2：多层级
```
1. 创建：A → B → C → D
2. 删除：D → C → B → A
3. 还原：D
4. 验证：A → B → C → D 层级正确
```

### 测试用例3：部分还原
```
1. 创建：A → B → C
2. 删除：C → B → A
3. 还原：A → C
4. 验证：A 下有 C，B 未还原
```

### 测试用例4：重复还原
```
1. 创建：A → B
2. 删除：B → A
3. 还原：B（创建A）
4. 还原：A（创建A(1)）
5. 验证：A 和 A(1) 都存在，B 在 A 下
```

## 优势

1. **层级完整性** - 正确重建文件夹层级
2. **递归创建** - 自动创建所有必需的父文件夹
3. **路径可靠** - 使用物理路径作为备用查找方式
4. **向后兼容** - 支持旧的回收站数据
5. **智能处理** - 自动处理各种边界情况

## 注意事项

1. **性能考虑** - 递归创建可能需要多次数据库操作
2. **并发问题** - 多个还原操作可能创建重复的父文件夹
3. **路径变化** - 如果用户手动修改了文件夹结构，可能影响查找
4. **回收站清理** - 父文件夹的回收记录应该保留，直到所有子项都还原

## 后续优化

1. **批量还原优化** - 一次还原多个项目时，共享父文件夹创建
2. **还原预览** - 显示将要创建的文件夹结构
3. **智能合并** - 提供选项合并到现有文件夹
4. **路径缓存** - 缓存物理路径查找结果，提高性能
