# 部署指南 - 独立应用程序

## 概述

本指南介绍如何将文件分享系统打包成独立的可执行应用程序，方便在 Windows、Linux 和 macOS 上部署。

## 构建应用程序

### 前提条件

1. 安装 Node.js (v14 或更高版本)
2. 安装项目依赖

```bash
cd backend
npm install
```

### 构建所有平台

```bash
cd backend
npm run build
```

这将生成以下可执行文件：
- `dist/file-share-win.exe` - Windows 版本
- `dist/file-share-linux` - Linux 版本
- `dist/file-share-macos` - macOS 版本

### 构建单个平台

```bash
# 仅构建 Windows 版本
npm run build:win

# 仅构建 Linux 版本
npm run build:linux

# 仅构建 macOS 版本
npm run build:macos
```

## 部署步骤

### Windows 部署

1. **准备文件**
   ```
   file-share-system/
   ├── file-share-win.exe
   ├── start.bat
   ├── .env.example
   ├── README.txt
   ├── data/
   ├── files/
   └── logs/
   ```

2. **配置环境**
   - 复制 `.env.example` 为 `.env`
   - 编辑 `.env` 文件配置数据库和端口

3. **启动应用**
   - 双击 `start.bat` 或
   - 命令行运行: `file-share-win.exe`

4. **访问应用**
   - 打开浏览器访问: `http://localhost:3000`

### Linux 部署

1. **准备文件**
   ```bash
   mkdir file-share-system
   cd file-share-system
   # 复制以下文件到此目录
   # - file-share-linux
   # - start.sh
   # - .env.example
   # - README.txt
   ```

2. **添加执行权限**
   ```bash
   chmod +x file-share-linux
   chmod +x start.sh
   ```

3. **配置环境**
   ```bash
   cp .env.example .env
   nano .env  # 或使用其他编辑器
   ```

4. **启动应用**
   ```bash
   ./start.sh
   # 或直接运行
   ./file-share-linux
   ```

5. **后台运行（可选）**
   ```bash
   # 使用 nohup
   nohup ./file-share-linux > output.log 2>&1 &
   
   # 或使用 screen
   screen -S file-share
   ./file-share-linux
   # Ctrl+A, D 分离会话
   
   # 或使用 systemd (推荐)
   # 见下方 systemd 配置
   ```

### macOS 部署

1. **准备文件**
   ```bash
   mkdir file-share-system
   cd file-share-system
   # 复制文件到此目录
   ```

2. **添加执行权限**
   ```bash
   chmod +x file-share-macos
   chmod +x start.sh
   ```

3. **配置和启动**
   ```bash
   cp .env.example .env
   nano .env
   ./start.sh
   ```

## 配置说明

### 环境变量 (.env)

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库类型 (json/mongodb/mysql/postgresql)
DB_TYPE=json

# CORS 配置（重要！）
# 快速测试：使用 * 允许所有源
CORS_ORIGIN=*
# 生产环境：配置具体域名
# CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# JSON 数据库配置（使用 json 时）
JSON_DATA_DIR=./data

# MongoDB 配置（使用 mongodb 时）
MONGODB_URI=mongodb://localhost:27017/file-share

# MySQL 配置（使用 mysql 时）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=file_share

# PostgreSQL 配置（使用 postgresql 时）
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DATABASE=file_share

# JWT 配置
JWT_SECRET=your-very-secure-secret-key-change-this
JWT_EXPIRES_IN=7d

# CORS 配置
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# 文件上传配置
MAX_FILE_SIZE=100
UPLOAD_DIR=./files
```

## 系统服务配置

### Linux Systemd 服务

创建服务文件 `/etc/systemd/system/file-share.service`:

```ini
[Unit]
Description=File Share System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/file-share-system
ExecStart=/opt/file-share-system/file-share-linux
Restart=on-failure
RestartSec=10
StandardOutput=append:/opt/file-share-system/logs/app.log
StandardError=append:/opt/file-share-system/logs/error.log

# 环境变量
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

启用和管理服务：

```bash
# 重载 systemd 配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start file-share

# 开机自启
sudo systemctl enable file-share

# 查看状态
sudo systemctl status file-share

# 查看日志
sudo journalctl -u file-share -f

# 停止服务
sudo systemctl stop file-share

# 重启服务
sudo systemctl restart file-share
```

### Windows 服务

使用 NSSM (Non-Sucking Service Manager):

1. **下载 NSSM**
   - 访问 https://nssm.cc/download
   - 下载并解压

2. **安装服务**
   ```cmd
   nssm install FileShareSystem "C:\path\to\file-share-win.exe"
   ```

3. **配置服务**
   ```cmd
   nssm set FileShareSystem AppDirectory "C:\path\to\file-share-system"
   nssm set FileShareSystem DisplayName "File Share System"
   nssm set FileShareSystem Description "文件分享系统服务"
   nssm set FileShareSystem Start SERVICE_AUTO_START
   ```

4. **管理服务**
   ```cmd
   # 启动服务
   nssm start FileShareSystem
   
   # 停止服务
   nssm stop FileShareSystem
   
   # 重启服务
   nssm restart FileShareSystem
   
   # 卸载服务
   nssm remove FileShareSystem confirm
   ```

## 反向代理配置

### Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 客户端最大上传大小
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Apache 配置

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    Redirect permanent / https://your-domain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName your-domain.com

    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # 上传大小限制
    LimitRequestBody 104857600

    <Location />
        Order allow,deny
        Allow from all
    </Location>
</VirtualHost>
```

## 防火墙配置

### Linux (UFW)

```bash
# 允许应用端口
sudo ufw allow 3000/tcp

# 如果使用 Nginx/Apache
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### Linux (firewalld)

```bash
# 允许端口
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp

# 重载配置
sudo firewall-cmd --reload

# 查看规则
sudo firewall-cmd --list-all
```

### Windows 防火墙

```powershell
# 允许入站连接
New-NetFirewallRule -DisplayName "File Share System" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

## 数据备份

### 自动备份脚本

创建备份脚本 `backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backup/file-share"
APP_DIR="/opt/file-share-system"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库文件（JSON模式）
if [ -d "$APP_DIR/data" ]; then
    tar -czf "$BACKUP_DIR/data_$DATE.tar.gz" -C "$APP_DIR" data/
fi

# 备份上传的文件
if [ -d "$APP_DIR/files" ]; then
    tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" -C "$APP_DIR" files/
fi

# 备份配置文件
cp "$APP_DIR/.env" "$BACKUP_DIR/.env_$DATE"

# 删除30天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name ".env_*" -mtime +30 -delete

echo "Backup completed: $DATE"
```

添加到 crontab (每天凌晨2点备份):

```bash
crontab -e
# 添加以下行
0 2 * * * /path/to/backup.sh >> /var/log/file-share-backup.log 2>&1
```

## 监控和日志

### 日志位置

- 应用日志: `logs/app.log`
- 错误日志: `logs/error.log`
- 访问日志: `logs/access.log`

### 日志轮转

创建 `/etc/logrotate.d/file-share`:

```
/opt/file-share-system/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload file-share > /dev/null 2>&1 || true
    endscript
}
```

## 性能优化

### 系统优化

```bash
# 增加文件描述符限制
ulimit -n 65535

# 永久设置
echo "* soft nofile 65535" >> /etc/security/limits.conf
echo "* hard nofile 65535" >> /etc/security/limits.conf
```

### 应用优化

在 `.env` 中配置:

```env
# 启用生产模式
NODE_ENV=production

# 调整上传限制
MAX_FILE_SIZE=100

# 启用压缩
ENABLE_COMPRESSION=true
```

## 故障排查

### 常见问题

1. **端口被占用**
   ```bash
   # Linux
   sudo lsof -i :3000
   sudo netstat -tulpn | grep 3000
   
   # Windows
   netstat -ano | findstr :3000
   ```

2. **权限问题**
   ```bash
   # 确保目录权限正确
   chmod 755 file-share-linux
   chmod -R 755 data/ files/ logs/
   ```

3. **数据库连接失败**
   - 检查数据库服务是否运行
   - 验证 `.env` 中的连接配置
   - 查看日志文件获取详细错误

4. **文件上传失败**
   - 检查 `files/` 目录权限
   - 确认磁盘空间充足
   - 检查 `MAX_FILE_SIZE` 配置

### 查看日志

```bash
# 实时查看日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 搜索特定错误
grep "ERROR" logs/app.log
```

## 安全建议

1. **修改默认密码**
   - 首次登录后立即修改 admin 密码

2. **使用强 JWT 密钥**
   - 生成随机密钥: `openssl rand -base64 32`

3. **启用 HTTPS**
   - 使用 Let's Encrypt 免费证书
   - 配置反向代理强制 HTTPS

4. **限制访问**
   - 配置防火墙规则
   - 使用 IP 白名单（如需要）

5. **定期更新**
   - 保持系统和依赖更新
   - 定期备份数据

6. **监控日志**
   - 定期检查异常访问
   - 设置日志告警

## 更新应用

1. **备份数据**
   ```bash
   ./backup.sh
   ```

2. **停止服务**
   ```bash
   sudo systemctl stop file-share
   ```

3. **替换可执行文件**
   ```bash
   cp file-share-linux.new file-share-linux
   chmod +x file-share-linux
   ```

4. **启动服务**
   ```bash
   sudo systemctl start file-share
   ```

5. **验证更新**
   ```bash
   curl http://localhost:3000/health
   ```

## 技术支持

如遇问题，请：
1. 查看日志文件
2. 检查配置文件
3. 参考故障排查章节
4. 提交 Issue 到项目仓库

## 总结

通过本指南，你可以：
- ✅ 构建跨平台的独立应用程序
- ✅ 在 Windows/Linux/macOS 上部署
- ✅ 配置系统服务自动启动
- ✅ 设置反向代理和 HTTPS
- ✅ 实现自动备份和监控
- ✅ 优化性能和安全性

祝部署顺利！🚀
