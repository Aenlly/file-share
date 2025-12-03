# CORS 错误快速修复指南

## 🚨 遇到 CORS 错误？

如果你看到这个错误：
```
Error: Not allowed by CORS
```

## ⚡ 快速解决（3 步）

### 步骤 1：找到 .env 文件

在应用程序目录中找到 `.env` 文件。如果没有，复制 `.env.example`：

```bash
# Windows
copy .env.example .env

# Linux/macOS
cp .env.example .env
```

### 步骤 2：修改 CORS 配置

打开 `.env` 文件，找到 `CORS_ORIGIN` 这一行，修改为：

```env
CORS_ORIGIN=*
```

**完整示例：**
```env
PORT=3000
NODE_ENV=production
DB_TYPE=json
JWT_SECRET=your-secret-key
CORS_ORIGIN=*
```

### 步骤 3：重启应用

```bash
# Windows
# 关闭当前运行的程序，然后重新运行
file-share-win.exe

# Linux
./file-share-linux

# 或如果使用 systemd
sudo systemctl restart file-share
```

## ✅ 验证修复

1. 打开浏览器访问你的应用
2. 尝试登录
3. 如果能正常登录，说明修复成功！

## 🔒 生产环境安全配置

测试成功后，为了安全，建议配置具体的域名：

```env
# 单个域名
CORS_ORIGIN=https://yourdomain.com

# 多个域名
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

## 📝 常见场景配置

### 场景 1：通过 IP 访问

```env
CORS_ORIGIN=http://192.168.1.100:3000
```

### 场景 2：通过域名访问

```env
CORS_ORIGIN=https://yourdomain.com
```

### 场景 3：本地测试

```env
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
```

### 场景 4：移动端访问

```env
# 允许所有源（最简单）
CORS_ORIGIN=*

# 或指定移动端访问的 IP
CORS_ORIGIN=http://192.168.1.100:3000
```

## 🔍 仍然有问题？

### 检查清单

- [ ] 已修改 `.env` 文件
- [ ] 已重启应用程序
- [ ] 已清除浏览器缓存
- [ ] 检查浏览器控制台（F12）查看具体错误

### 查看日志

```bash
# 查看应用日志
tail -f logs/app.log

# Windows
type logs\app.log
```

### 获取帮助

如果以上方法都不行，请：
1. 查看完整的 CORS 配置指南：`CORS_CONFIGURATION.md`
2. 查看部署指南：`DEPLOYMENT_GUIDE.md`
3. 提交 Issue 并附上日志文件

## 💡 提示

- `CORS_ORIGIN=*` 允许所有源访问，适合快速测试
- 生产环境建议配置具体域名以提高安全性
- 修改配置后必须重启应用才能生效
- 如果使用 Nginx 反向代理，可能需要额外配置

---

**记住：修改 .env 后一定要重启应用！** 🔄
