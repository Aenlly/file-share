# 分片上传大小调整

## 修改内容

已将分片上传的大小从 **200KB** 调整为 **20MB**，以提高上传效率。

## 修改的文件

### 前端
- `frontend/src/components/FolderDetail/FileUploadCard.jsx`
  - `DEFAULT_CHUNK_SIZE`: 5MB → 20MB
  - `uploadFileInChunks()` 中的 `CHUNK_SIZE`: 200KB → 20MB

### 后端
- `backend/src/config/index.js`
  - `chunkSize`: 5MB → 20MB（默认值）
  
- `backend/.env.example`
  - 新增 `CHUNK_SIZE` 配置说明

## 优势

1. **更少的请求次数**：20MB 分片相比 200KB 分片，请求次数减少约 100 倍
2. **更高的上传效率**：大幅减少网络往返时间和请求开销
3. **更好的性能**：显著降低服务器处理分片的负担

## 示例

上传一个 1GB 的文件：
- **之前（200KB）**：需要约 5120 个分片
- **现在（20MB）**：只需要 51 个分片

上传一个 300MB 的文件：
- **之前（200KB）**：需要约 1536 个分片
- **现在（20MB）**：只需要 15 个分片

## 配置

如需自定义分片大小，可在 `backend/.env` 中设置：

```env
# 20MB (默认)
CHUNK_SIZE=20971520

# 10MB
CHUNK_SIZE=10485760

# 50MB
CHUNK_SIZE=52428800

# 100MB
CHUNK_SIZE=104857600
```

## 限流配置

分片上传 API 已从全局限流中排除，不受速率限制：
- `/api/folders/:folderId/chunk/init` - 初始化分片上传
- `/api/folders/:folderId/chunk` - 上传分片
- `/api/folders/:folderId/chunk/complete` - 完成上传

这样可以确保大文件上传时不会因为频繁的分片请求而触发 429 错误。

## 注意事项

- 前端和后端的分片大小应保持一致
- 分片过大可能导致单次请求超时（建议不超过 100MB）
- 分片过小会增加请求次数和开销
- 建议范围：10MB - 50MB（当前设置为 20MB）
- 分片上传 API 不受速率限制，可以快速连续上传
- 20MB 分片在大多数网络环境下都能保持良好的上传速度和稳定性
