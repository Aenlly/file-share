# 上传文件 413 错误 - 快速修复

## 🚨 问题

上传文件时出现：
```
413 Payload Too Large
```

## ⚡ 3 步快速修复

### 步骤 1：修改 .env 文件

编辑 `.env` 文件，添加或修改：

```env
MAX_FILE_SIZE=524288000
BODY_LIMIT=500mb
```

### 步骤 2：重启应用

```bash
# Linux
sudo systemctl restart file-share

# Windows
# 关闭程序后重新运行 file-share-win.exe
```

### 步骤 3：配置 Nginx（如果使用）

编辑 Nginx 配置文件：

```nginx
server {
    # 增加这一行
    client_max_body_size 500M;
    
    location / {
        proxy_pass http://localhost:3000;
        # ... 其他配置
    }
}
```

重启 Nginx：
```bash
sudo systemctl restart nginx
```

## ✅ 完成！

现在应该可以上传大文件了。

## 📊 常用大小配置

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

## 💡 提示

- 对于超大文件，使用"分片上传"功能
- 修改配置后必须重启服务
- 如果使用反向代理，也需要配置反向代理

## 📖 详细文档

查看完整指南：`FILE_UPLOAD_413_FIX.md`
