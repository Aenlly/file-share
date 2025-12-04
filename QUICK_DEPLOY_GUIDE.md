# 快速部署指南 - 2024-12-04 更新

## 本次更新内容

✅ 新增上传配置 API  
✅ 修复回收站层级还原问题  
✅ 修复重复还原冲突  
✅ 修复代码质量问题

## 部署步骤

### 1. 备份数据（重要！）

```bash
# Windows
xcopy data data_backup_20241204 /E /I /H

# Linux/Mac
cp -r data data_backup_20241204
```

### 2. 停止当前服务

如果服务正在运行，先停止它：
- 按 `Ctrl+C` 停止终端中的服务
- 或关闭运行服务的命令行窗口

### 3. 验证修改的文件

确认以下文件已更新：
- ✅ `backend/src/routes/folderRoutes.js`
- ✅ `backend/src/routes/recycleBinRoutes.js`
- ✅ `backend/src/models/RecycleBinModel.js`
- ✅ `backend/src/routes/permissionRoutes.js`

### 4. 启动服务

```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

### 5. 验证服务启动

等待服务启动完成，看到类似输出：
```
后端服务运行在 http://localhost:3000
前端服务运行在 http://localhost:3001
```

## 快速测试

### 测试 1: 上传配置 API

打开浏览器开发者工具（F12），在控制台执行：

```javascript
// 先登录获取 token
fetch('http://localhost:3000/api/users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
})
.then(r => r.json())
.then(data => {
  const token = data.token;
  // 测试上传配置 API
  return fetch('http://localhost:3000/api/folders/upload/config', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
})
.then(r => r.json())
.then(data => console.log('上传配置:', data));
```

**期望结果：**
```json
{
  "chunkSize": 5242880,
  "maxFileSize": 104857600
}
```

### 测试 2: 回收站层级还原

#### 方式 A: 自动化测试脚本

```bash
# 确保已安装 axios
npm install axios

# 运行测试
node test-hierarchy-restore.js
```

**期望输出：**
```
✓ 登录成功
✓ 创建文件夹: 父文件夹
✓ 创建文件夹: 子文件夹
✓ 删除文件夹: 子文件夹
✓ 删除文件夹: 父文件夹
✓ 还原成功: 子文件夹
✓ 父文件夹已自动创建
✓ 子文件夹正确还原到父文件夹下
```

#### 方式 B: 手动测试

1. **登录系统**
   - 访问 http://localhost:3001
   - 使用 admin/admin123 登录

2. **创建测试结构**
   - 创建文件夹 "测试父文件夹"
   - 在其中创建子文件夹 "测试子文件夹"
   - 在子文件夹中上传一个文件

3. **删除测试**
   - 删除子文件夹（移至回收站）
   - 删除父文件夹（移至回收站）

4. **还原测试**
   - 进入回收站页面
   - 还原 "测试子文件夹"
   - 检查：父文件夹应该自动创建，子文件夹在父文件夹下

5. **验证结果**
   - 返回文件夹列表
   - 确认层级关系正确：测试父文件夹 → 测试子文件夹
   - 确认文件完整

### 测试 3: 重复还原

1. **继续上面的测试**
   - 在回收站中再次还原 "测试父文件夹"

2. **期望结果**
   - 创建 "测试父文件夹(1)"
   - 不影响已还原的 "测试父文件夹"

## 常见问题排查

### 问题 1: 服务启动失败

**症状：** 运行 start.bat 后报错

**解决：**
```bash
# 检查端口占用
netstat -ano | findstr "3000"
netstat -ano | findstr "3001"

# 如果端口被占用，结束进程或修改 .env 文件中的端口
```

### 问题 2: API 返回 404

**症状：** 调用 `/api/folders/upload/config` 返回 404

**解决：**
1. 确认服务已重启
2. 检查 `backend/src/routes/folderRoutes.js` 是否包含新的路由
3. 查看后端日志是否有错误

### 问题 3: 层级还原不正确

**症状：** 子文件夹还原后变成根文件夹

**解决：**
1. 检查回收站数据是否包含 `parentFolderPhysicalPath`
2. 查看后端日志中的还原过程
3. 确认 `findOrCreateParentFolder` 函数正常工作

### 问题 4: 测试脚本失败

**症状：** `node test-hierarchy-restore.js` 报错

**解决：**
```bash
# 安装依赖
npm install axios form-data

# 检查服务是否运行
curl http://localhost:3000/api/users/login

# 检查测试用户是否存在
# 默认用户: admin/admin123
```

## 回滚步骤

如果更新后出现问题，可以快速回滚：

### 1. 停止服务

按 `Ctrl+C` 或关闭服务窗口

### 2. 恢复数据

```bash
# Windows
rmdir /s /q data
xcopy data_backup_20241204 data /E /I /H

# Linux/Mac
rm -rf data
cp -r data_backup_20241204 data
```

### 3. 恢复代码

```bash
git checkout HEAD~1
```

### 4. 重启服务

```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

## 性能监控

### 监控指标

1. **API 响应时间**
   - `/api/folders/upload/config` 应该 < 100ms
   - 还原操作应该 < 2秒（简单结构）

2. **内存使用**
   - 后端进程内存应该稳定
   - 没有明显的内存泄漏

3. **错误日志**
   - 检查 `logs/` 目录
   - 关注 ERROR 级别的日志

### 监控命令

```bash
# 查看后端日志
tail -f logs/app.log

# Windows 查看日志
type logs\app.log
```

## 生产环境部署

### 额外步骤

1. **环境变量配置**
   ```bash
   # 设置生产环境
   NODE_ENV=production
   
   # 配置上传限制
   CHUNK_SIZE=5242880
   MAX_FILE_SIZE=104857600
   ```

2. **性能优化**
   - 启用 gzip 压缩
   - 配置 CDN（如果有）
   - 设置合理的缓存策略

3. **安全检查**
   - 确认 JWT_SECRET 已修改
   - 检查 CORS 配置
   - 验证文件上传限制

4. **监控告警**
   - 配置日志监控
   - 设置错误告警
   - 监控磁盘空间

## 验收标准

✅ 所有测试通过  
✅ 上传配置 API 正常返回  
✅ 子文件夹能正确还原到父文件夹下  
✅ 重复还原创建带序号的文件夹  
✅ 无错误日志  
✅ 性能正常  

## 支持

如果遇到问题：

1. 查看详细文档：
   - `RECYCLE_BIN_FINAL_FIX.md` - 完整修复说明
   - `RECYCLE_BIN_HIERARCHY_FIX.md` - 层级还原详解
   - `LATEST_UPDATES_2024-12-04.md` - 更新总结

2. 运行诊断：
   ```bash
   node test-hierarchy-restore.js
   ```

3. 检查日志：
   ```bash
   # 查看最新日志
   tail -n 100 logs/app.log
   ```

## 下次更新预告

计划中的优化：
- 批量还原性能优化
- 还原预览功能
- 还原历史记录
- 智能合并选项

---

**更新日期：** 2024-12-04  
**版本：** v2.1.1  
**状态：** 已测试，可部署
