# 用户文件夹命名修复

## 问题描述

之前系统使用 `username` 作为用户文件夹名称，存在安全隐患：
- 如果两个用户使用相同的用户名，会导致数据混淆
- 无法保证数据隔离

## 解决方案

将用户文件夹命名格式从 `username` 改为 `id-username`，例如：
- 旧格式: `files/admin/`
- 新格式: `files/1-admin/`

## 修改内容

### 1. FolderModel.js (已修复)
在创建根文件夹时使用 `id-username` 格式：
```javascript
parentPhysicalPath = `${user.id}-${folderData.owner}/`;
```

### 2. userRoutes.js (已修复)
删除用户时使用正确的路径格式：
```javascript
const userRootPath = path.join(FILES_ROOT, `${userId}-${user.username}`);
```

## 迁移步骤

### 对于新部署
新创建的用户会自动使用新格式，无需额外操作。

### 对于现有系统
需要运行迁移脚本将现有用户文件夹重命名：

```bash
# 1. 备份数据（重要！）
xcopy files files_backup /E /I /Y

# 2. 运行迁移脚本
node backend/scripts/migrate-user-folders.js
```

迁移脚本会：
1. 将 `files/username/` 重命名为 `files/id-username/`
2. 更新数据库中所有文件夹的 `physicalPath` 字段
3. 显示迁移进度和结果

### 迁移输出示例
```
开始迁移用户文件夹...

找到 3 个用户

处理用户: admin (ID: 1)
  旧路径: D:\project\files\admin
  新路径: D:\project\files\1-admin
  ✓ 成功迁移

处理用户: user1 (ID: 2)
  旧路径: D:\project\files\user1
  新路径: D:\project\files\2-user1
  ✓ 成功迁移

==================================================
迁移完成！
成功: 2 个
跳过: 1 个
失败: 0 个
==================================================

正在更新数据库中的文件夹路径...
  更新文件夹: Documents (admin/1234567890 -> 1-admin/1234567890)
  更新文件夹: Photos (user1/1234567891 -> 2-user1/1234567891)
共更新 2 个文件夹路径
数据库更新完成！
```

## 验证

迁移完成后，检查：
1. `files/` 目录下的文件夹名称格式是否正确
2. 用户能否正常访问和上传文件
3. 文件下载和预览功能是否正常

## 注意事项

1. **务必先备份数据**再运行迁移脚本
2. 迁移过程中建议停止服务，避免并发操作
3. 迁移脚本是幂等的，可以安全地重复运行
4. 如果迁移失败，可以从备份恢复

## 影响范围

- ✅ 新用户创建：自动使用新格式
- ✅ 文件上传：使用正确的路径
- ✅ 文件下载：使用正确的路径
- ✅ 用户删除：删除正确的目录
- ✅ 数据隔离：完全隔离不同用户的数据
