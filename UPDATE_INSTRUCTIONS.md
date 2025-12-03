# 更新说明 - CORS 修复版本

## 更新内容

本次更新修复了部署时的 CORS 跨域问题，现在可以更方便地部署到服务器。

### 主要改进

1. **CORS 配置优化**
   - 支持 `CORS_ORIGIN=*` 快速部署
   - 改进的错误处理和日志记录
   - 生产/开发环境分离配置

2. **默认配置改进**
   - `.env.example` 默认使用 `CORS_ORIGIN=*`
   - 开箱即用，无需额外配置

3. **文档完善**
   - CORS 快速修复指南
   - 详细的配置文档
   - 故障排查指南

## 如何更新

### 方法 1：重新构建（推荐）

如果你还没有分发应用，建议重新构建：

```bash
# 1. 拉取最新代码
git pull

# 2. 安装依赖
npm install
npm run install:all

# 3. 重新构建
npm run build:release
```

这将生成包含修复的新版本：
- `release/file-share-windows.zip`
- `release/file-share-linux.zip`
- `release/file-share-macos.zip`

### 方法 2：手动更新已部署的应用

如果应用已经部署，可以手动修复：

#### 步骤 1：修改 .env 文件

在应用目录中编辑 `.env` 文件，添加或修改：

```env
CORS_ORIGIN=*
```

#### 步骤 2：重启应用

```bash
# Linux systemd
sudo systemctl restart file-share

# 直接运行（需要先停止旧进程）
./file-share-linux

# Windows
# 关闭当前运行的程序，然后重新运行
file-share-win.exe
```

#### 步骤 3：验证

访问应用并测试登录功能。

### 方法 3：替换可执行文件

如果需要使用新的代码逻辑：

1. 构建新的可执行文件：
   ```bash
   cd backend
   npm run build
   ```

2. 备份旧文件：
   ```bash
   # Linux
   cp file-share-linux file-share-linux.backup
   
   # Windows
   copy file-share-win.exe file-share-win.exe.backup
   ```

3. 替换可执行文件：
   ```bash
   # 从 backend/dist/ 复制新文件到部署目录
   cp backend/dist/file-share-linux /path/to/deployment/
   ```

4. 重启应用

## 配置说明

### 快速部署（测试环境）

```env
# .env
PORT=3000
NODE_ENV=production
DB_TYPE=json
JWT_SECRET=your-secret-key
CORS_ORIGIN=*
```

### 生产环境（推荐）

```env
# .env
PORT=3000
NODE_ENV=production
DB_TYPE=json
JWT_SECRET=your-very-secure-random-secret-key
CORS_ORIGIN=https://yourdomain.com
```

### 多域名支持

```env
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com,https://app.yourdomain.com
```

## 验证更新

### 1. 检查版本

查看日志文件，应该看到改进的 CORS 日志：

```bash
tail -f logs/app.log
```

### 2. 测试 CORS

访问应用并尝试登录，不应该再看到 CORS 错误。

### 3. 检查配置

```bash
# 查看当前 CORS 配置
cat .env | grep CORS_ORIGIN

# Windows
type .env | findstr CORS_ORIGIN
```

## 回滚方案

如果更新后出现问题，可以回滚：

### 回滚可执行文件

```bash
# Linux
cp file-share-linux.backup file-share-linux

# Windows
copy file-share-win.exe.backup file-share-win.exe
```

### 回滚配置

恢复之前的 `.env` 文件配置。

## 常见问题

### Q: 更新后仍然有 CORS 错误？

**A:** 确保：
1. 已修改 `.env` 文件
2. 已重启应用
3. 已清除浏览器缓存

### Q: 需要重新构建前端吗？

**A:** 不需要，这次更新只涉及后端。

### Q: 数据会丢失吗？

**A:** 不会，更新不影响数据：
- `data/` 目录（数据库文件）
- `files/` 目录（上传的文件）
- `logs/` 目录（日志文件）

### Q: 如何确认使用的是新版本？

**A:** 查看日志文件，新版本会有更详细的 CORS 日志记录。

## 技术细节

### 修改的文件

1. **backend/src/app.js**
   - 优化 CORS 中间件
   - 添加环境区分
   - 改进日志记录

2. **backend/.env.example**
   - 更新默认 CORS 配置
   - 添加配置说明

### 新增的文档

- `CORS_QUICK_FIX.md` - 快速修复指南
- `CORS_CONFIGURATION.md` - 详细配置指南
- `CORS_FIX_SUMMARY.md` - 修复总结
- `UPDATE_INSTRUCTIONS.md` - 本文档

## 后续步骤

1. **测试环境**
   - 使用 `CORS_ORIGIN=*` 快速部署
   - 验证所有功能正常

2. **生产环境**
   - 配置具体域名
   - 启用 HTTPS
   - 定期检查日志

3. **监控**
   - 关注 CORS 相关日志
   - 及时处理异常访问

## 获取帮助

如果遇到问题：

1. 查看快速修复指南：`CORS_QUICK_FIX.md`
2. 查看详细配置：`CORS_CONFIGURATION.md`
3. 查看日志文件：`logs/app.log`
4. 提交 Issue 并附上日志

## 总结

这次更新让部署更加简单：
- ✅ 开箱即用的 CORS 配置
- ✅ 灵活的配置选项
- ✅ 详细的文档支持
- ✅ 改进的错误处理

**建议：重新构建应用以获得最佳体验！**

```bash
npm run build:release
```

---

更新日期：2025-12-03
版本：v2.0.1 (CORS Fix)
