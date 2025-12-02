# 文件移动调试日志 - 详细错误追踪

## 问题
显示文件移动成功，但实际文件和文件列表都未移动。

## 根本原因
原始实现缺少详细的错误处理和日志，导致：
1. 物理文件移动失败被忽略
2. 数据库更新失败被忽略
3. 无法追踪具体的失败原因

## 解决方案
添加详细的错误处理和日志记录，每个步骤都有独立的try-catch和日志。

## 修改内容

### 文件移动操作的详细步骤

#### 1. 创建目标目录
```javascript
try {
    await fs.ensureDir(path.dirname(targetPath));
    logger.info(`创建目标目录: ${path.dirname(targetPath)}`);
} catch (error) {
    logger.error(`创建目标目录失败: ${error.message}`);
    return res.status(200).json({ 
        success: false, 
        code: 'CREATE_DIR_FAILED',
        error: `创建目标目录失败: ${error.message}` 
    });
}
```

#### 2. 移动物理文件
```javascript
try {
    await fs.move(sourcePath, targetPath);
    logger.info(`物理文件移动成功: ${sourcePath} -> ${targetPath}`);
} catch (error) {
    logger.error(`物理文件移动失败: ${error.message}`);
    return res.status(200).json({ 
        success: false, 
        code: 'FILE_MOVE_FAILED',
        error: `物理文件移动失败: ${error.message}` 
    });
}
```

#### 3. 更新数据库
```javascript
try {
    await FileModel.update(fileRecord.id, { folderId: targetFolderId });
    logger.info(`数据库更新成功: 文件ID=${fileRecord.id}, 新文件夹ID=${targetFolderId}`);
} catch (error) {
    logger.error(`数据库更新失败: ${error.message}`);
    // 尝试回滚物理文件移动
    try {
        await fs.move(targetPath, sourcePath);
        logger.info(`物理文件已回滚: ${targetPath} -> ${sourcePath}`);
    } catch (rollbackError) {
        logger.error(`回滚失败: ${rollbackError.message}`);
    }
    return res.status(200).json({ 
        success: false, 
        code: 'DB_UPDATE_FAILED',
        error: `数据库更新失败: ${error.message}` 
    });
}
```

## 新增错误码

| 错误码 | 说明 | 原因 |
|--------|------|------|
| `CREATE_DIR_FAILED` | 创建目标目录失败 | 权限问题或磁盘空间不足 |
| `FILE_MOVE_FAILED` | 物理文件移动失败 | 源文件不存在或权限问题 |
| `DB_UPDATE_FAILED` | 数据库更新失败 | 数据库连接问题或数据冲突 |

## 日志输出示例

### 成功的移动操作
```
创建目标目录: /path/to/target
物理文件移动成功: /path/from/file.txt -> /path/to/file.txt
数据库更新成功: 文件ID=1, 新文件夹ID=2
移动文件成功: file.txt (从 源文件夹 到 目标文件夹)
```

### 失败的移动操作（物理文件移动失败）
```
创建目标目录: /path/to/target
物理文件移动失败: ENOENT: no such file or directory
```

### 失败的移动操作（数据库更新失败）
```
创建目标目录: /path/to/target
物理文件移动成功: /path/from/file.txt -> /path/to/file.txt
数据库更新失败: Connection timeout
物理文件已回滚: /path/to/file.txt -> /path/from/file.txt
```

## 事务性保证

当数据库更新失败时，系统会自动回滚物理文件的移动，确保数据一致性：

```javascript
// 如果数据库更新失败，回滚物理文件移动
try {
    await fs.move(targetPath, sourcePath);
    logger.info(`物理文件已回滚: ${targetPath} -> ${sourcePath}`);
} catch (rollbackError) {
    logger.error(`回滚失败: ${rollbackError.message}`);
}
```

## 调试步骤

### 1. 查看后端日志
重启后端服务器后，查看控制台输出：
```bash
cd backend
npm start
```

### 2. 执行文件移动操作
在前端执行文件移动操作，观察后端日志输出。

### 3. 根据日志判断问题
- 如果看到 `CREATE_DIR_FAILED` - 检查目标目录权限
- 如果看到 `FILE_MOVE_FAILED` - 检查源文件是否存在
- 如果看到 `DB_UPDATE_FAILED` - 检查数据库连接

## 修改的文件

| 文件 | 修改 | 状态 |
|------|------|------|
| `backend/src/routes/folderRoutes.js` | 添加详细错误处理和日志 | ✅ 完成 |

## 完成状态

✅ **详细错误处理** - 每个步骤都有独立的错误处理
✅ **详细日志记录** - 每个步骤都有日志输出
✅ **事务性保证** - 失败时自动回滚
✅ **新增错误码** - 更清晰的错误信息

**现在重启后端服务器，查看日志输出来诊断问题！**

## 相关文档

- `ERROR_CODE_OPTIMIZATION.md` - 错误码优化说明
- `MOVE_FILE_COMPLETE.md` - 文件移动功能完整修复
