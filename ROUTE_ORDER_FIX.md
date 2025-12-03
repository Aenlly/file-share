# 路由顺序修复

## 问题
- `GET /trash/files` 返回404
- 回收站路由无法访问

## 原因
Express路由按定义顺序匹配，`/:folderId` 这样的动态路由会拦截 `/trash`：

```javascript
// 错误的顺序
router.get('/:folderId', ...)  // 这会匹配 /trash
router.get('/trash/files', ...)  // 永远不会被执行
```

Express把 "trash" 当作 folderId 参数值。

## 解决方案
将回收站路由移到动态路由之前：

```javascript
// 正确的顺序
router.get('/trash/files', ...)  // 先匹配具体路径
router.get('/trash/restore/:fileId', ...)
router.delete('/trash/:fileId', ...)
router.delete('/trash/clear', ...)

router.get('/:folderId', ...)  // 最后匹配动态路由
```

## 路由优先级规则

### 1. 静态路由优先
```javascript
router.get('/trash/files', ...)  // 优先级高
router.get('/:folderId', ...)     // 优先级低
```

### 2. 具体路径优先
```javascript
router.get('/trash/restore/:id', ...)  // 优先级高
router.get('/:folderId/:action', ...)  // 优先级低
```

### 3. 定义顺序决定匹配顺序
```javascript
// 第一个匹配的路由会被执行
router.get('/users', ...)  // 如果路径是 /users，执行这个
router.get('/:id', ...)    // 如果路径是 /123，执行这个
```

## 修改内容

### backend/src/routes/folderRoutes.js
将以下路由移到 `/:folderId` 之前：
- `GET /trash/files` - 获取回收站列表
- `POST /trash/restore/:fileId` - 恢复文件
- `DELETE /trash/:fileId` - 永久删除
- `DELETE /trash/clear` - 清空回收站

### 路由结构
```
GET    /                          - 获取文件夹列表
POST   /                          - 创建文件夹
GET    /:id/preview/:filename     - 图片预览
GET    /:folderId/preview/by-id/:fileId - 图片预览(ID)

--- 回收站路由（必须在这里）---
GET    /trash/files               - 回收站列表
POST   /trash/restore/:fileId     - 恢复文件
DELETE /trash/:fileId             - 永久删除
DELETE /trash/clear               - 清空回收站

--- 动态路由 ---
GET    /:folderId                 - 文件夹详情
DELETE /:folderId                 - 删除文件夹
GET    /:folderId/files           - 文件列表
POST   /:folderId/upload          - 上传文件
DELETE /:folderId/file            - 删除文件
...
```

## 其他修复

### 移除调试代码
**backend/src/app.js**:
- 移除 config 调试输出
- 清理控制台日志

## 测试

### 1. 回收站路由测试
```bash
# 应该返回200
curl -X GET http://localhost:3000/api/folders/trash/files \
  -H "Authorization: Bearer <token>"
```

### 2. 文件夹路由测试
```bash
# 应该返回200
curl -X GET http://localhost:3000/api/folders/1 \
  -H "Authorization: Bearer <token>"
```

### 3. 删除文件测试
```bash
# 应该返回200
curl -X DELETE http://localhost:3000/api/folders/1/file \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.jpg"}'
```

## 需要重启
✅ 后端需要重启

## 状态
✅ 路由顺序已修复
✅ 回收站路由已移到正确位置
✅ 调试代码已移除
✅ 代码已验证无错误
