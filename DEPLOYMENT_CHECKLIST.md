# 部署检查清单

## 📋 部署前检查

### 1. 代码验证
- [x] 所有文件通过语法检查
- [x] 没有编译错误
- [x] 关键功能已测试

### 2. 配置检查
- [ ] `.env` 文件配置正确
- [ ] 数据库连接配置正确
- [ ] 端口号没有冲突（默认8001）
- [ ] 文件上传大小限制合理（默认500MB）

### 3. 依赖检查
```bash
cd backend
npm install
```

确认所有依赖已安装。

## 🚀 部署步骤

### 步骤1: 停止旧服务

```bash
# 如果服务正在运行，按 Ctrl+C 停止
```

### 步骤2: 备份数据（重要！）

```bash
# 备份数据库文件
xcopy backend\data backend\data_backup\ /E /I /Y

# 或者
robocopy backend\data backend\data_backup /E
```

### 步骤3: 清理临时文件

```bash
# 删除临时文件
del /s backend\data\*.tmp

# 清理日志（可选）
del backend\logs\*.log
```

### 步骤4: 启动新服务

```bash
cd backend
npm start
```

### 步骤5: 验证启动

确认看到以下输出：
```
✅ 服务器运行在端口 8001
📊 数据库类型: json
🔐 环境: development
🗑️  回收站自动清理任务已启动
```

## ✅ 部署后验证

### 1. 基本功能测试

在浏览器中测试：

- [ ] 登录功能正常
- [ ] 文件夹列表显示正常
- [ ] 文件上传成功
- [ ] 文件下载成功
- [ ] 文件删除成功
- [ ] 回收站功能正常
- [ ] 文件移动功能正常

### 2. 并发测试（可选）

```bash
cd backend
node test-concurrent-requests.js
```

预期结果：
- [ ] 成功率 > 95%
- [ ] 500错误率 = 0%
- [ ] 503错误率 < 5%（如果有）

### 3. 日志检查

```bash
# 查看最新日志
type backend\logs\combined.log

# 查看错误日志
type backend\logs\error.log
```

确认：
- [ ] 没有意外的错误
- [ ] 日志格式正确
- [ ] 可以看到操作记录

### 4. 性能监控

```bash
# 查看锁等待情况
type backend\logs\combined.log | findstr "等待数据库锁"

# 查看锁持有时间
type backend\logs\combined.log | findstr "持有时间"
```

正常情况：
- [ ] 等待时间 < 5秒
- [ ] 持有时间 < 2秒
- [ ] 没有频繁的锁竞争

## 🔍 故障排查

### 问题1: 服务无法启动

**检查端口占用**：
```bash
netstat -ano | findstr :8001
```

**解决方案**：
- 停止占用端口的进程
- 或修改 `.env` 中的 `PORT` 配置

### 问题2: 数据库错误

**检查数据库文件**：
```bash
dir backend\data
```

应该看到：
- folders.json
- files.json
- users.json
- shares.json
- recycle_bin.json

**解决方案**：
- 如果文件损坏，从备份恢复
- 如果文件缺失，删除所有文件让系统重新创建

### 问题3: 仍然有500错误

**查看详细日志**：
```bash
type backend\logs\error.log
```

**可能原因**：
1. 磁盘空间不足
2. 文件权限问题
3. 数据库文件损坏

**解决方案**：
1. 清理磁盘空间
2. 检查文件权限
3. 从备份恢复数据

## 📊 监控指标

### 关键指标

1. **响应时间**
   - 正常：< 1秒
   - 警告：1-3秒
   - 异常：> 3秒

2. **错误率**
   - 正常：< 1%
   - 警告：1-5%
   - 异常：> 5%

3. **锁等待时间**
   - 正常：< 1秒
   - 警告：1-5秒
   - 异常：> 5秒

4. **锁持有时间**
   - 正常：< 500ms
   - 警告：500ms-2秒
   - 异常：> 2秒

### 监控命令

```bash
# 实时查看日志
Get-Content backend\logs\combined.log -Wait -Tail 50

# 统计错误数量
type backend\logs\error.log | find /c "ERROR"

# 查看最近的错误
type backend\logs\error.log | more
```

## 🔄 回滚计划

如果部署后出现严重问题：

### 步骤1: 停止服务
```bash
# Ctrl+C 停止服务
```

### 步骤2: 恢复数据
```bash
# 从备份恢复
xcopy backend\data_backup backend\data /E /I /Y
```

### 步骤3: 恢复代码
```bash
# 使用git恢复
git checkout HEAD~1

# 或者从备份恢复
```

### 步骤4: 重启服务
```bash
cd backend
npm start
```

## 📝 部署记录

### 本次部署信息

- **部署日期**：2025-12-03
- **版本**：v2.0 - 锁机制改进
- **主要改进**：
  1. 延长锁等待时间（5秒→30秒）
  2. 改进错误消息
  3. 增强日志记录
  4. 修复回收站路由

### 修改的文件

**核心文件**：
- backend/src/database/adapters/JsonAdapter.js
- backend/src/middleware/errorHandler.js
- backend/src/models/FileModel.js
- backend/src/models/FolderModel.js
- backend/src/routes/folderRoutes.js
- backend/src/app.js

**新增文件**：
- backend/test-concurrent-requests.js
- FINAL_FIX_GUIDE.md
- LOCK_MECHANISM_IMPROVEMENT.md
- DEPLOYMENT_CHECKLIST.md

### 预期效果

- ✅ 500错误率降至接近0%
- ✅ 用户体验改善
- ✅ 系统更加稳定
- ✅ 更好的可观测性

## 🎯 成功标准

部署成功的标准：

1. ✅ 服务正常启动
2. ✅ 所有基本功能正常
3. ✅ 并发测试通过（成功率>95%）
4. ✅ 没有频繁的500错误
5. ✅ 日志记录正常
6. ✅ 用户反馈良好

## 📞 支持联系

如果遇到问题：

1. 查看 `FINAL_FIX_GUIDE.md`
2. 查看 `backend/logs/error.log`
3. 运行并发测试查看具体问题
4. 检查系统资源（CPU、内存、磁盘）

## ✨ 完成确认

- [ ] 所有检查项已完成
- [ ] 服务运行正常
- [ ] 功能测试通过
- [ ] 日志记录正常
- [ ] 性能指标正常
- [ ] 用户可以正常使用

**部署完成！** 🎉
