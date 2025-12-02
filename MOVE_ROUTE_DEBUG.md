# 文件移动路由调试指南

## 问题
前端调用 `POST /api/folders/1/move` 返回404错误。

## 已完成的修复
1. ✅ 将文件移动功能从 `fileMoveRoutes.js` 集成到 `folderRoutes.js`
2. ✅ 删除了 `backend/src/routes/fileMoveRoutes.js` 文件
3. ✅ 更新了 `app.js`，移除了 `fileMoveRoutes` 的导入和注册
4. ✅ 在 `folderRoutes.js` 中添加了 `POST /:folderId/move` 路由

## 路由定义验证

### folderRoutes.js 中的路由定义
```javascript
router.post('/:folderId/move', authenticate, async (req, res, next) => {
    // ... 路由处理代码
});
```

### app.js 中的路由注册
```javascript
app.use('/api/folders', folderRoutes);
```

## 可能的原因

### 1. 后端服务器未重启（最可能）
**症状**：代码已修改，但仍然返回404

**解决方案**：
- 停止后端服务器（Ctrl+C）
- 重新启动后端服务器
- 清除浏览器缓存（Ctrl+Shift+Delete）
- 重新尝试文件移动操作

### 2. 路由冲突
**症状**：路由定义正确，但仍然无法访问

**验证方法**：
在 `folderRoutes.js` 中添加调试日志：
```javascript
router.post('/:folderId/move', authenticate, async (req, res, next) => {
    console.log('=== 文件移动路由被调用 ===');
    console.log('folderId:', req.params.folderId);
    console.log('body:', req.body);
    // ... 其他代码
});
```

### 3. 前端API调用错误
**症状**：前端发送的请求格式不正确

**验证方法**：
在浏览器开发者工具中检查：
- 请求URL：应该是 `http://localhost:8001/api/folders/1/move`
- 请求方法：应该是 `POST`
- 请求体：应该包含 `filename` 和 `targetFolderId`

## 完整的路由列表

```
GET    /api/folders                          - 获取用户的所有文件夹
POST   /api/folders                          - 创建文件夹
GET    /api/folders/:folderId                - 获取文件夹详情
DELETE /api/folders/:folderId                - 删除文件夹
GET    /api/folders/:folderId/files          - 获取文件夹内的文件
POST   /api/folders/:folderId/upload         - 上传文件
DELETE /api/folders/:folderId/file           - 删除文件
GET    /api/folders/:folderId/download/:filename - 下载文件
POST   /api/folders/:folderId/move           - 移动文件 ✨ 新增
GET    /api/folders/:folderId/subfolders     - 获取子文件夹
```

## 测试步骤

### 1. 验证后端服务器已启动
```bash
curl http://localhost:8001/health
```

预期响应：
```json
{
    "status": "ok",
    "timestamp": "2024-11-28T...",
    "database": "json"
}
```

### 2. 测试文件移动API
```bash
curl -X POST http://localhost:8001/api/folders/1/move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "filename": "test.txt",
    "targetFolderId": 2
  }'
```

### 3. 检查后端日志
查看后端控制台输出，应该看到：
```
移动文件: test.txt (从 源文件夹 到 目标文件夹)
```

## 文件修改清单

- ✅ `backend/src/routes/folderRoutes.js` - 添加了 `POST /:folderId/move` 路由
- ✅ `backend/src/app.js` - 移除了 `fileMoveRoutes` 的导入和注册
- ✅ `backend/src/routes/fileMoveRoutes.js` - 已删除

## 下一步

1. **重启后端服务器**
2. **清除浏览器缓存**
3. **重新尝试文件移动操作**
4. **检查浏览器开发者工具中的网络请求**

如果问题仍然存在，请检查：
- 后端服务器是否正确启动
- 是否有其他错误日志
- 前端是否正确发送了请求
