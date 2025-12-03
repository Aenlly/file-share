# 文件上传 413 错误修复指南

## 问题描述

上传文件时出现 HTTP 413 错误：
```
POST /api/folders/{id}/upload
状态码: 413 Payload Too Large
```

这表示上传的文件超过了服务器允许的大小限制。

## 快速解决方案

### 方案 1：修改应用配置（推荐）

编辑 `.env` 文件，增加文件大小限制：

```env
# 最大文件大小：500MB
MAX_FILE_SIZE=524288000

# 请求体大小限制
BODY_LIMIT=500mb
```

**常用大小配置：**
```env
# 100MB
MAX_FILE_SIZE=104857600
BODY_LIMIT=100mb

# 500MB（推荐）
MAX_FILE_SIZE=524288000
BODY_LIMIT=500mb

# 1GB
MAX_FILE_SIZE=1073741824
BODY_LIMIT=1gb

# 2GB
MAX_FILE_SIZE=2147483648
BODY_LIMIT=2gb
```

重启应用后生效。

### 方案 2：配置 Nginx（如果使用）

如果你使用 Nginx 作为反向代理，还需要配置 Nginx：

编辑 Nginx 配置文件（通常在 `/etc/nginx/sites-available/` 或 `/etc/nginx/conf.d/`）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 增加客户端请求体大小限制
    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # 增加超时时间（大文件上传需要更长时间）
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
```

重启 Nginx：
```bash
sudo nginx -t  # 测试配置
sudo systemctl restart nginx
```

### 方案 3：配置 Apache（如果使用）

如果使用 Apache，编辑配置文件：

```apache
<VirtualHost *:80>
    ServerName your-domain.com

    # 增加请求体大小限制（500MB）
    LimitRequestBody 524288000

    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # 增加超时时间
    ProxyTimeout 600
</VirtualHost>
```

重启 Apache：
```bash
sudo apachectl configtest  # 测试配置
sudo systemctl restart apache2
```

## 完整配置步骤

### 步骤 1：修改应用配置

编辑 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 文件上传配置
MAX_FILE_SIZE=524288000    # 500MB
BODY_LIMIT=500mb

# 其他配置...
DB_TYPE=json
JWT_SECRET=your-secret-key
CORS_ORIGIN=*
```

### 步骤 2：重启应用

```bash
# Linux systemd
sudo systemctl restart file-share

# 直接运行
./file-share-linux

# Windows
# 关闭程序后重新运行
file-share-win.exe
```

### 步骤 3：配置反向代理（如果使用）

#### Nginx 配置

```nginx
http {
    # 全局配置
    client_max_body_size 500M;
    client_body_timeout 600s;
    
    server {
        listen 80;
        server_name your-domain.com;
        
        # 或在 server 块中配置
        client_max_body_size 500M;
        
        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            
            # 超时配置
            proxy_connect_timeout 600s;
            proxy_send_timeout 600s;
            proxy_read_timeout 600s;
            
            # 请求头配置
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
```

#### Apache 配置

```apache
# 在主配置或虚拟主机中
LimitRequestBody 524288000

<VirtualHost *:80>
    ServerName your-domain.com
    
    # 超时配置
    Timeout 600
    ProxyTimeout 600
    
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

### 步骤 4：验证配置

1. 重启所有服务
2. 尝试上传大文件
3. 检查日志文件

## 不同场景的配置

### 场景 1：小型部署（个人使用）

```env
# 100MB 限制
MAX_FILE_SIZE=104857600
BODY_LIMIT=100mb
```

```nginx
client_max_body_size 100M;
```

### 场景 2：中型部署（团队使用）

```env
# 500MB 限制（推荐）
MAX_FILE_SIZE=524288000
BODY_LIMIT=500mb
```

```nginx
client_max_body_size 500M;
```

### 场景 3：大型部署（企业使用）

```env
# 2GB 限制
MAX_FILE_SIZE=2147483648
BODY_LIMIT=2gb
```

```nginx
client_max_body_size 2G;
```

### 场景 4：视频/大文件存储

```env
# 5GB 限制
MAX_FILE_SIZE=5368709120
BODY_LIMIT=5gb
```

```nginx
client_max_body_size 5G;
client_body_timeout 1200s;  # 20分钟
```

## 使用分片上传

对于超大文件（>500MB），建议使用分片上传功能：

1. 在上传界面启用"使用分片上传"选项
2. 分片上传会将大文件分成小块上传
3. 每块默认 200KB，不受文件大小限制影响

## 验证配置

### 1. 检查应用配置

```bash
# 查看 .env 文件
cat .env | grep MAX_FILE_SIZE
cat .env | grep BODY_LIMIT

# Windows
type .env | findstr MAX_FILE_SIZE
type .env | findstr BODY_LIMIT
```

### 2. 检查 Nginx 配置

```bash
# 查看配置
sudo nginx -T | grep client_max_body_size

# 测试配置
sudo nginx -t
```

### 3. 检查 Apache 配置

```bash
# 查看配置
sudo apachectl -S | grep LimitRequestBody

# 测试配置
sudo apachectl configtest
```

### 4. 测试上传

使用 curl 测试：

```bash
# 创建测试文件（100MB）
dd if=/dev/zero of=test.bin bs=1M count=100

# 测试上传
curl -X POST http://your-server:3000/api/folders/1/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@test.bin" \
  -v
```

## 故障排查

### 问题 1：修改后仍然 413 错误

**可能原因：**
- 没有重启应用
- Nginx/Apache 配置未更新
- 配置文件语法错误

**解决方案：**
1. 确认 `.env` 文件已保存
2. 重启应用
3. 检查并重启 Nginx/Apache
4. 查看日志文件

### 问题 2：上传速度很慢

**可能原因：**
- 网络带宽限制
- 服务器性能不足
- 超时设置太短

**解决方案：**
1. 增加超时时间
2. 使用分片上传
3. 检查网络连接

### 问题 3：上传到一半失败

**可能原因：**
- 超时设置太短
- 磁盘空间不足
- 内存不足

**解决方案：**
```nginx
# Nginx 增加超时
proxy_connect_timeout 1200s;
proxy_send_timeout 1200s;
proxy_read_timeout 1200s;
client_body_timeout 1200s;
```

```env
# 使用分片上传
# 在上传界面启用"使用分片上传"
```

### 问题 4：Nginx 配置不生效

**检查配置文件位置：**
```bash
# 查找配置文件
sudo nginx -T

# 常见位置
/etc/nginx/nginx.conf
/etc/nginx/sites-available/default
/etc/nginx/conf.d/*.conf
```

**确保配置在正确的位置：**
```nginx
# 在 http 块中（全局）
http {
    client_max_body_size 500M;
}

# 或在 server 块中（特定站点）
server {
    client_max_body_size 500M;
}
```

## 性能优化建议

### 1. 使用分片上传

- 适合大文件（>100MB）
- 减少内存占用
- 支持断点续传

### 2. 调整缓冲区大小

```nginx
# Nginx 优化
client_body_buffer_size 128k;
client_body_temp_path /var/nginx/client_body_temp;
```

### 3. 启用压缩

```nginx
# Nginx 压缩
gzip on;
gzip_types text/plain application/json;
gzip_min_length 1000;
```

### 4. 增加工作进程

```nginx
# Nginx 工作进程
worker_processes auto;
worker_connections 1024;
```

## 安全建议

1. **不要设置过大的限制**
   - 根据实际需求设置
   - 避免资源耗尽攻击

2. **监控磁盘空间**
   ```bash
   df -h
   ```

3. **设置速率限制**
   - 已在应用中配置
   - 可在 Nginx 中额外限制

4. **定期清理临时文件**
   ```bash
   # 清理 Nginx 临时文件
   sudo rm -rf /var/nginx/client_body_temp/*
   ```

## 日志检查

### 应用日志

```bash
tail -f logs/app.log
```

查找上传相关错误：
```bash
grep "upload" logs/app.log
grep "413" logs/app.log
```

### Nginx 日志

```bash
# 访问日志
tail -f /var/log/nginx/access.log

# 错误日志
tail -f /var/log/nginx/error.log
```

### Apache 日志

```bash
# 访问日志
tail -f /var/log/apache2/access.log

# 错误日志
tail -f /var/log/apache2/error.log
```

## 总结

解决 413 错误需要配置三个层面：

1. **应用层** - `.env` 文件
   ```env
   MAX_FILE_SIZE=524288000
   BODY_LIMIT=500mb
   ```

2. **反向代理层** - Nginx/Apache
   ```nginx
   client_max_body_size 500M;
   ```

3. **超时配置** - 大文件需要更长时间
   ```nginx
   proxy_read_timeout 600s;
   ```

**记住：修改配置后必须重启服务！** 🔄

---

如果还有问题，请查看日志文件或提交 Issue。
