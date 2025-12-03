# CORS 配置指南

## 问题说明

如果你在部署服务器时遇到 CORS 错误：
```
Error: Not allowed by CORS
```

这是因为浏览器的同源策略阻止了跨域请求。

## 快速解决方案

### 方案 1：允许所有源（最简单，适合测试）

编辑 `.env` 文件：

```env
CORS_ORIGIN=*
```

**优点：** 简单快速，适合快速部署测试
**缺点：** 安全性较低，不推荐用于生产环境

### 方案 2：配置特定域名（推荐生产环境）

编辑 `.env` 文件，添加你的前端域名：

```env
# 单个域名
CORS_ORIGIN=https://yourdomain.com

# 多个域名（用逗号分隔）
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com,https://app.yourdomain.com
```

### 方案 3：同时部署前后端（无需 CORS）

如果前后端部署在同一个域名下，无需配置 CORS：

```
https://yourdomain.com/          # 前端
https://yourdomain.com/api/      # 后端 API
```

使用 Nginx 反向代理配置：

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 常见部署场景

### 场景 1：本地开发

```env
# 前端运行在 http://localhost:5173
# 后端运行在 http://localhost:3000
CORS_ORIGIN=http://localhost:5173,http://localhost:3001
```

### 场景 2：服务器部署（前后端分离）

```env
# 前端: https://app.example.com
# 后端: https://api.example.com
CORS_ORIGIN=https://app.example.com
```

### 场景 3：服务器部署（同域名）

```env
# 前端和后端都在 https://example.com
# 通过 Nginx 反向代理
CORS_ORIGIN=https://example.com
```

### 场景 4：多环境部署

```env
# 支持开发、测试、生产环境
CORS_ORIGIN=http://localhost:5173,https://test.example.com,https://example.com
```

### 场景 5：内网部署

```env
# 允许内网 IP 访问
CORS_ORIGIN=http://192.168.1.100:3000,http://192.168.1.101:3000
```

## 环境变量配置

### 开发环境 (.env.development)

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173,http://localhost:3001
```

### 生产环境 (.env.production)

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com
```

## 验证 CORS 配置

### 1. 检查浏览器控制台

打开浏览器开发者工具（F12），查看 Network 标签：

- 查看请求头中的 `Origin`
- 查看响应头中的 `Access-Control-Allow-Origin`

### 2. 使用 curl 测试

```bash
# 测试 OPTIONS 预检请求
curl -X OPTIONS http://your-server:3000/api/users/login \
  -H "Origin: http://your-frontend-domain" \
  -H "Access-Control-Request-Method: POST" \
  -v

# 测试实际请求
curl -X POST http://your-server:3000/api/users/login \
  -H "Origin: http://your-frontend-domain" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -v
```

### 3. 检查日志

查看后端日志文件：

```bash
tail -f logs/app.log
```

如果有 CORS 问题，会看到类似的警告：
```
CORS: 未配置的源尝试访问: http://some-domain.com
```

## 故障排查

### 问题 1：仍然报 CORS 错误

**解决方案：**

1. 确认 `.env` 文件已正确配置
2. 重启后端服务
3. 清除浏览器缓存
4. 检查前端请求的 URL 是否正确

### 问题 2：配置了域名但还是不行

**可能原因：**

- 协议不匹配（http vs https）
- 端口不匹配
- 子域名不匹配（www vs 非 www）

**解决方案：**

确保 CORS_ORIGIN 中的域名与浏览器地址栏完全一致：

```env
# 错误示例
CORS_ORIGIN=example.com              # 缺少协议
CORS_ORIGIN=http://example.com       # 协议不匹配（实际是 https）
CORS_ORIGIN=https://example.com      # 缺少 www

# 正确示例
CORS_ORIGIN=https://www.example.com  # 完全匹配
```

### 问题 3：Nginx 反向代理后仍有 CORS 问题

**解决方案：**

在 Nginx 配置中添加 CORS 头：

```nginx
location /api/ {
    # 添加 CORS 头
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    # 处理 OPTIONS 预检请求
    if ($request_method = 'OPTIONS') {
        return 204;
    }

    proxy_pass http://localhost:3000/api/;
    # ... 其他配置
}
```

### 问题 4：移动端访问报 CORS 错误

**解决方案：**

移动端访问时，确保 CORS_ORIGIN 包含移动端访问的域名或 IP：

```env
# 如果通过 IP 访问
CORS_ORIGIN=http://192.168.1.100:3000

# 如果通过域名访问
CORS_ORIGIN=https://m.example.com

# 或允许所有（测试用）
CORS_ORIGIN=*
```

## 安全建议

### 生产环境

1. **不要使用 `*`**
   ```env
   # ❌ 不安全
   CORS_ORIGIN=*
   
   # ✅ 安全
   CORS_ORIGIN=https://yourdomain.com
   ```

2. **使用 HTTPS**
   ```env
   # ❌ 不安全
   CORS_ORIGIN=http://yourdomain.com
   
   # ✅ 安全
   CORS_ORIGIN=https://yourdomain.com
   ```

3. **限制具体域名**
   ```env
   # ✅ 只允许特定域名
   CORS_ORIGIN=https://app.example.com,https://admin.example.com
   ```

### 开发环境

开发环境可以使用更宽松的配置：

```env
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:3001,http://127.0.0.1:5173
```

## 完整配置示例

### 示例 1：单页应用（SPA）

```env
# .env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://app.example.com
JWT_SECRET=your-secret-key
DB_TYPE=json
```

### 示例 2：多环境支持

```env
# .env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://app.example.com,https://test.example.com,https://dev.example.com
JWT_SECRET=your-secret-key
DB_TYPE=postgresql
```

### 示例 3：内网部署

```env
# .env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=http://192.168.1.100:8080,http://192.168.1.101:8080
JWT_SECRET=your-secret-key
DB_TYPE=json
```

## 测试 CORS 配置

创建一个简单的 HTML 文件测试：

```html
<!DOCTYPE html>
<html>
<head>
    <title>CORS Test</title>
</head>
<body>
    <h1>CORS Configuration Test</h1>
    <button onclick="testCORS()">Test CORS</button>
    <pre id="result"></pre>

    <script>
        async function testCORS() {
            const result = document.getElementById('result');
            try {
                const response = await fetch('http://your-server:3000/health', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();
                result.textContent = 'Success!\n' + JSON.stringify(data, null, 2);
            } catch (error) {
                result.textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
```

## 总结

1. **快速解决：** 设置 `CORS_ORIGIN=*`
2. **生产环境：** 配置具体域名
3. **同域部署：** 使用 Nginx 反向代理
4. **检查日志：** 查看 `logs/app.log` 了解详情
5. **重启服务：** 修改配置后记得重启

如果还有问题，请查看日志文件或提交 Issue。
