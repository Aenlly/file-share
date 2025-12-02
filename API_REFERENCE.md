# API 参考文档

## 📋 目录

- [认证](#认证)
- [用户管理](#用户管理)
- [文件夹管理](#文件夹管理)
- [文件管理](#文件管理)
- [分享管理](#分享管理)
- [公开分享](#公开分享)
- [系统](#系统)

## 基础信息

**基础URL：** `http://localhost:3000/api`

**认证方式：** JWT Bearer Token

**请求头：**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**响应格式：**
```json
{
  "data": {},
  "error": null,
  "statusCode": 200
}
```

## 认证

### 用户登录

**请求：**
```http
POST /users/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**响应：**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "menuPermissions": ["manageUsers", "viewFolders"]
  }
}
```

**状态码：**
- `200` - 登录成功
- `401` - 用户名或密码错误
- `429` - 请求过于频繁

## 用户管理

### 获取所有用户

**请求：**
```http
GET /users
Authorization: Bearer <token>
```

**权限：** 管理员

**响应：**
```json
[
  {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "menuPermissions": ["manageUsers", "viewFolders"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 创建用户

**请求：**
```http
POST /users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "role": "user"
}
```

**权限：** 管理员

**响应：**
```json
{
  "id": 2,
  "username": "newuser",
  "role": "user",
  "menuPermissions": ["viewFolders"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**状态码：**
- `201` - 创建成功
- `400` - 请求参数错误
- `409` - 用户名已存在

### 获取当前用户

**请求：**
```http
GET /users/me
Authorization: Bearer <token>
```

**响应：**
```json
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "menuPermissions": ["manageUsers", "viewFolders"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 更新用户

**请求：**
```http
PUT /users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "admin"
}
```

**权限：** 管理员或用户本人

**响应：**
```json
{
  "id": 2,
  "username": "newuser",
  "role": "admin",
  "menuPermissions": ["manageUsers", "viewFolders"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 修改密码

**请求：**
```http
POST /users/:id/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "oldPassword": "oldpass123",
  "newPassword": "newpass123"
}
```

**权限：** 管理员或用户本人

**响应：**
```json
{
  "success": true,
  "message": "密码修改成功"
}
```

### 删除用户

**请求：**
```http
DELETE /users/:id
Authorization: Bearer <token>
```

**权限：** 管理员

**响应：**
```json
{
  "success": true,
  "message": "用户删除成功"
}
```

**状态码：**
- `200` - 删除成功
- `400` - 不能删除自己
- `404` - 用户不存在

## 文件夹管理

### 获取文件夹列表

**请求：**
```http
GET /folders
Authorization: Bearer <token>
```

**响应：**
```json
[
  {
    "id": 1,
    "alias": "我的文件夹",
    "physicalPath": "admin/1704067200000",
    "owner": "admin",
    "parentId": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 创建文件夹

**请求：**
```http
POST /folders
Authorization: Bearer <token>
Content-Type: application/json

{
  "alias": "新文件夹",
  "parentId": null
}
```

**响应：**
```json
{
  "id": 2,
  "alias": "新文件夹",
  "physicalPath": "admin/1704067200001",
  "owner": "admin",
  "parentId": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**状态码：**
- `201` - 创建成功
- `400` - 请求参数错误

### 获取文件夹详情

**请求：**
```http
GET /folders/:id
Authorization: Bearer <token>
```

**响应：**
```json
{
  "id": 1,
  "alias": "我的文件夹",
  "physicalPath": "admin/1704067200000",
  "owner": "admin",
  "parentId": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 删除文件夹

**请求：**
```http
DELETE /folders/:id
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "message": "文件夹删除成功"
}
```

### 获取子文件夹

**请求：**
```http
GET /folders/:id/subfolders
Authorization: Bearer <token>
```

**响应：**
```json
[
  {
    "id": 2,
    "alias": "子文件夹",
    "physicalPath": "admin/1704067200000/1704067200001",
    "owner": "admin",
    "parentId": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

## 文件管理

### 获取文件列表

**请求：**
```http
GET /folders/:id/files
Authorization: Bearer <token>
```

**响应：**
```json
[
  {
    "id": 1,
    "name": "document.pdf",
    "savedName": "abc123_2024-01-01T00-00-00-000Z.pdf",
    "size": 1024000,
    "mtime": "2024-01-01T00:00:00.000Z",
    "mimeType": "application/pdf",
    "uploadTime": "2024-01-01T00:00:00.000Z"
  }
]
```

### 上传文件

**请求：**
```http
POST /folders/:id/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

files: [file1, file2, ...]
force: false
```

**参数：**
- `files` - 文件数组（最多200个）
- `force` - 是否强制覆盖（可选）

**响应：**
```json
{
  "success": true,
  "uploadedFiles": [
    {
      "id": 1,
      "originalName": "document.pdf",
      "savedName": "abc123_2024-01-01T00-00-00-000Z.pdf",
      "size": 1024000
    }
  ],
  "existingFiles": [],
  "errorFiles": [],
  "total": 1
}
```

**状态码：**
- `200` - 上传成功
- `409` - 文件已存在
- `400` - 上传失败

### 删除文件

**请求：**
```http
DELETE /folders/:id/file
Authorization: Bearer <token>
Content-Type: application/json

{
  "filenames": ["file1.pdf", "file2.pdf"]
}
```

**响应：**
```json
{
  "success": true,
  "deletedFiles": ["file1.pdf", "file2.pdf"],
  "errorFiles": [],
  "total": 2
}
```

### 下载文件

**请求：**
```http
GET /folders/:id/download/:filename
Authorization: Bearer <token>
```

**响应：** 文件二进制内容

### 移动文件

**请求：**
```http
POST /folders/:id/move
Authorization: Bearer <token>
Content-Type: application/json

{
  "filename": "document.pdf",
  "targetFolderId": 2
}
```

**响应：**
```json
{
  "success": true,
  "message": "文件移动成功"
}
```

## 分享管理

### 获取分享列表

**请求：**
```http
GET /shares
Authorization: Bearer <token>
```

**响应：**
```json
[
  {
    "id": 1,
    "code": "ABC123",
    "folderId": 1,
    "owner": "admin",
    "expireTime": 1704153600000,
    "folderAlias": "我的文件夹",
    "isExpired": false,
    "remainingTime": 86400000,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 创建分享

**请求：**
```http
POST /shares
Authorization: Bearer <token>
Content-Type: application/json

{
  "folderId": 1,
  "expireInMs": 604800000
}
```

**参数：**
- `folderId` - 文件夹ID
- `expireInMs` - 过期时间（毫秒，可选，默认7天）

**响应：**
```json
{
  "code": "ABC123",
  "expireTime": "2024-01-08T00:00:00.000Z"
}
```

### 更新分享

**请求：**
```http
PUT /shares/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "expireInMs": 2592000000
}
```

**响应：**
```json
{
  "expireTime": "2024-02-01T00:00:00.000Z"
}
```

### 删除分享

**请求：**
```http
DELETE /shares/:id
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "message": "分享删除成功"
}
```

### 批量删除分享

**请求：**
```http
POST /shares/batch/delete
Authorization: Bearer <token>
Content-Type: application/json

{
  "shareIds": [1, 2, 3]
}
```

**响应：**
```json
{
  "success": true,
  "deletedIds": [1, 2, 3],
  "errorIds": []
}
```

### 批量延长分享

**请求：**
```http
POST /shares/batch/extend
Authorization: Bearer <token>
Content-Type: application/json

{
  "shareIds": [1, 2, 3],
  "expireInMs": 604800000
}
```

**响应：**
```json
{
  "success": true,
  "updatedIds": [1, 2, 3],
  "errorIds": []
}
```

## 公开分享

### 验证访问码

**请求：**
```http
POST /shares/verify
Content-Type: application/json

{
  "code": "ABC123"
}
```

**响应：**
```json
{
  "folderId": 1,
  "folderAlias": "我的文件夹"
}
```

**状态码：**
- `200` - 验证成功
- `410` - 分享链接已过期或不存在

### 获取分享文件

**请求：**
```http
GET /shares/:code/files
```

**响应：**
```json
[
  {
    "id": 1,
    "name": "document.pdf",
    "savedName": "abc123_2024-01-01T00-00-00-000Z.pdf",
    "size": 1024000,
    "mimeType": "application/pdf"
  }
]
```

### 下载分享文件

**请求：**
```http
GET /shares/:code/download/:filename
```

**响应：** 文件二进制内容

### 下载分享文件夹

**请求：**
```http
GET /shares/:code/download-all
```

**响应：** ZIP文件二进制内容

### 获取图片预览

**请求：**
```http
GET /shares/:code/preview/:filename?width=200&height=200
```

**参数：**
- `width` - 预览宽度（可选，默认200）
- `height` - 预览高度（可选，默认200）

**响应：** 图片二进制内容

### 获取分享子文件夹

**请求：**
```http
GET /shares/:code/subfolders
```

**响应：**
```json
[
  {
    "id": 2,
    "alias": "子文件夹",
    "physicalPath": "admin/1704067200000/1704067200001",
    "owner": "admin",
    "parentId": 1
  }
]
```

## 系统

### 健康检查

**请求：**
```http
GET /health
```

**响应：**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "json"
}
```

## 错误响应

### 错误格式

```json
{
  "error": "错误信息",
  "statusCode": 400
}
```

### 常见错误码

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未登录或令牌过期 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 429 | 请求过于频繁 |
| 500 | 服务器错误 |

## 速率限制

- **全局限制：** 100请求/15分钟
- **登录限制：** 5次尝试/15分钟
- **上传限制：** 100次/小时

## 文件大小限制

- **单个文件：** 100MB
- **总存储：** 无限制（取决于磁盘空间）

## 分享链接

- **访问码长度：** 6-8字符
- **访问码字符集：** 大小写字母 + 数字
- **默认过期时间：** 7天
- **最长过期时间：** 无限制

---

**更新日期：** 2024-01-01  
**版本：** 2.0.0
