# 部署步骤 v2.0.2

**版本**: v2.0.2  
**发布日期**: 2024-12-04  
**类型**: 功能增强 + Bug修复

---

## 📋 更新内容

### 严重问题修复（v2.0.1）
1. ✅ 前端硬编码URL → 环境变量配置
2. ✅ 数据库锁缺陷 → 专业锁管理器
3. ✅ 文件哈希内存问题 → 流式计算

### 新增功能（v2.0.2）
1. ✅ 文件安全扫描
2. ✅ 分片上传会话持久化
3. ✅ 用户存储配额管理

---

## 🚀 快速部署

### 方式一：自动部署（推荐）

```bash
# 1. 停止服务
cd backend
npm stop  # 或 Ctrl+C

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖（如有新增）
npm install

# 4. 启动服务
npm start

# 5. 前端重新构建（可选）
cd ../frontend
npm run build
```

### 方式二：手动部署

```bash
# 1. 备份数据
cp -r backend/data backend/data.backup
cp -r files files.backup

# 2. 更新代码
git pull origin main

# 3. 检查新文件
ls backend/src/utils/fileScanner.js
ls backend/src/utils/storageCalculator.js
ls backend/src/utils/LockManager.js
ls backend/src/models/UploadSessionModel.js

# 4. 重启服务
cd backend
npm start
```

---

## 📝 配置更新

### 1. 前端环境变量（新增）

```bash
cd frontend

# 开发环境
cp .env.example .env
# 编辑 .env
VITE_API_URL=http://localhost:3000

# 生产环境
# 不需要配置，自动使用当前域名
```

### 2. 后端配置（可选）

**存储配额默认值**:
```javascript
// backend/src/models/UserModel.js
// 默认: 普通用户 10GB, 管理员 100GB
// 可根据需要修改
```

**文件扫描配置**:
```javascript
// 默认启用，如需禁用可在代码中修改
// backend/src/routes/fileRoutes.js
// 注释掉 scanFile 调用
```

---

## 🔄 数据迁移

### 1. 更新现有用户的存储配额

```bash
# 运行迁移脚本
node backend/scripts/migrate-storage-quota.js
```

或手动更新：
```javascript
// 在 Node.js REPL 中执行
const UserModel = require('./backend/src/models/UserModel');

(async () => {
    const users = await UserModel.getAll();
    for (const user of users) {
        if (!user.storageQuota) {
            const quota = user.role === 'admin' 
                ? 100 * 1024 * 1024 * 1024  // 100GB
                : 10 * 1024 * 1024 * 1024;  // 10GB
            await UserModel.update(user.id, { 
                storageQuota: quota,
                storageUsed: 0 
            });
        }
    }
    console.log('迁移完成');
})();
```

### 2. 计算现有用户的存储使用量

```bash
# 使用 API 重新计算
curl -X POST http://localhost:3000/api/users/storage/admin/recalculate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 或批量计算所有用户
node backend/scripts/recalculate-all-storage.js
```

---

## ✅ 验证部署

### 1. 检查服务状态

```bash
# 健康检查
curl http://localhost:3000/health

# 预期输出
{
  "status": "ok",
  "timestamp": "2024-12-04T...",
  "database": "json"
}
```

### 2. 测试新功能

**文件扫描**:
```bash
# 上传正常文件（应该成功）
curl -X POST -F "files=@test.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/folders/1/upload

# 上传伪装文件（应该被拒绝）
# 创建一个 .jpg 文件但内容是文本
echo "malicious content" > fake.jpg
curl -X POST -F "files=@fake.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/folders/1/upload
```

**存储配额**:
```bash
# 查看存储信息
curl http://localhost:3000/api/users/storage/admin \
  -H "Authorization: Bearer YOUR_TOKEN"

# 预期输出
{
  "storageQuota": 107374182400,
  "storageUsed": 1234567,
  "storageAvailable": 107372947833,
  ...
}
```

**上传会话持久化**:
```bash
# 初始化上传
curl -X POST http://localhost:3000/api/folders/1/chunk/init \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"fileName": "test.zip", "fileSize": 10485760}'

# 重启服务器
npm stop && npm start

# 会话应该仍然存在（可以继续上传）
```

### 3. 检查日志

```bash
# 查看最新日志
tail -f backend/logs/combined.log

# 应该看到
✅ 服务器运行在端口 3000
✅ 数据库类型: json
✅ 默认管理员创建成功
```

---

## 🔧 故障排查

### 问题1: 文件上传失败

**症状**: 所有文件上传都被拒绝

**原因**: 文件扫描过于严格

**解决**:
```javascript
// 临时禁用文件扫描
// backend/src/routes/fileRoutes.js
// 注释掉这几行:
// const scanResult = await scanFile(file.buffer, originalName);
// if (!scanResult.valid) { ... }
```

### 问题2: 存储配额显示错误

**症状**: 显示的存储使用量不正确

**解决**:
```bash
# 重新计算存储
curl -X POST http://localhost:3000/api/users/storage/USERNAME/recalculate \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 问题3: 上传会话丢失

**症状**: 分片上传中断后无法继续

**解决**:
```bash
# 检查数据库中的会话
# 如果使用 JSON 数据库
cat backend/data/uploadSessions.json

# 清理过期会话
curl -X POST http://localhost:3000/api/admin/cleanup-sessions \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 问题4: 锁管理器错误

**症状**: 出现"数据库繁忙"错误

**解决**:
```bash
# 检查锁状态
# 在 Node.js REPL 中
const lockManager = require('./backend/src/utils/LockManager');
console.log(lockManager.getStatus());

# 强制释放所有锁
lockManager.releaseAll();
```

---

## 📊 性能监控

### 关键指标

**文件上传**:
- 扫描时间: < 100ms
- 配额检查: < 50ms
- 总上传时间: 应该增加 < 10%

**存储计算**:
- 单用户计算: < 500ms
- 批量计算: < 5s (100用户)

**内存使用**:
- 大文件上传: 应该稳定在 < 50MB
- 锁管理器: < 1MB

### 监控命令

```bash
# 查看内存使用
ps aux | grep node

# 查看日志中的性能数据
grep "耗时" backend/logs/combined.log

# 查看锁等待时间
grep "等待数据库锁" backend/logs/combined.log
```

---

## 🔙 回滚方案

如果出现严重问题，可以快速回滚：

```bash
# 1. 停止服务
npm stop

# 2. 回滚代码
git checkout v2.0.0  # 或上一个稳定版本

# 3. 恢复数据（如果需要）
rm -rf backend/data
cp -r backend/data.backup backend/data

# 4. 重启服务
npm start

# 5. 验证
curl http://localhost:3000/health
```

---

## 📚 相关文档

- **详细修复报告**: `CRITICAL_FIXES_2024-12-04.md`
- **功能实现报告**: `ADDITIONAL_FEATURES_IMPLEMENTATION.md`
- **项目审查报告**: `PROJECT_AUDIT_ISSUES.md`
- **快速开始**: `CRITICAL_FIXES_QUICKSTART.md`

---

## 🎯 部署检查清单

- [ ] 备份数据
- [ ] 拉取最新代码
- [ ] 安装依赖
- [ ] 配置环境变量
- [ ] 运行数据迁移
- [ ] 重启服务
- [ ] 验证健康检查
- [ ] 测试文件上传
- [ ] 测试存储配额
- [ ] 检查日志
- [ ] 监控性能
- [ ] 通知用户

---

## 📞 支持

如有问题，请查看：
1. 日志文件: `backend/logs/`
2. 错误文档: `PROJECT_AUDIT_ISSUES.md`
3. GitHub Issues

---

**部署完成后请验证所有功能正常！**
