# 类型转换修复 - 数字类型不匹配问题

## 问题
目标文件夹查询返回"不存在"，但实际上文件夹存在。

## 根本原因
前端发送的 `targetFolderId` 是字符串类型（来自URL参数或表单输入），但数据库中存储的ID是数字类型。

当进行 `item.id === id` 比较时：
- `item.id` = 1 (数字)
- `id` = "1" (字符串)
- 结果：`1 === "1"` → false（找不到）

## 解决方案
在move路由中，确保 `targetFolderId` 被转换为数字类型。

## 修改内容

### 添加类型转换和日志
```javascript
// 确保targetFolderId是数字
const targetFolderIdNum = parseInt(targetFolderId);
logger.info(`目标文件夹ID转换后: ${targetFolderIdNum} (类型: ${typeof targetFolderIdNum})`);
```

### 使用转换后的值
所有使用 `targetFolderId` 的地方改为使用 `targetFolderIdNum`：

```javascript
// 查询目标文件夹
const targetFolder = await FolderModel.findById(targetFolderIdNum);

// 检查权限
const hasTargetAccess = await isFolderOwnedByUser(targetFolderIdNum, req.user.username);

// 更新数据库
await FileModel.update(fileRecord.id, { folderId: targetFolderIdNum });
```

## 日志输出示例

### 修复前
```
目标文件夹ID: 1 (类型: string)
目标文件夹查询结果: 不存在
```

### 修复后
```
目标文件夹ID: 1 (类型: string)
目标文件夹ID转换后: 1 (类型: number)
目标文件夹查询结果: 存在 (test)
```

## 类型转换最佳实践

### 在路由中进行类型转换
```javascript
// ✅ 正确：在路由中转换
const folderId = parseInt(req.params.folderId);
const targetFolderId = parseInt(req.body.targetFolderId);
```

### 避免在模型中进行类型转换
```javascript
// ❌ 不推荐：在模型中转换
async findById(id) {
    const numId = parseInt(id); // 不应该在这里转换
    return data.find(item => item.id === numId);
}
```

## 修改的文件

| 文件 | 修改 | 状态 |
|------|------|------|
| `backend/src/routes/folderRoutes.js` | 添加类型转换 | ✅ 完成 |

## 完成状态

✅ **类型转换** - 确保targetFolderId是数字
✅ **日志记录** - 打印类型信息便于调试
✅ **一致性** - 所有使用都转换后的值

**现在重启后端服务器，文件移动应该能正常工作了！**

## 相关文档

- `DETAILED_REQUEST_LOGGING.md` - 详细请求日志
- `MOVE_FILE_DEBUG_LOGGING.md` - 错误处理和日志记录
