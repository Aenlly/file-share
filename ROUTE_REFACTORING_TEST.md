# 路由重构测试指南

## 快速开始

### 1. 执行迁移

```bash
# Windows
migrate-routes.bat

# Linux/Mac
chmod +x migrate-routes.sh
./migrate-routes.sh
```

### 2. 重启服务

```bash
cd backend
npm start
```

### 3. 验证服务启动

查看日志，确认没有错误：
- ✅ 服务器运行在端口 3000
- ✅ 数据库初始化完成
- ✅ 没有模块加载错误

## 功能测试清单

### 文件夹管理 (folderRoutes.js)

#### 获取文件夹列表
```bash
curl -X GET http://localhost:3000/api/folders \
  -H "Authorization: Bearer YOUR_TOKEN"
```
预期: 返回文件夹列表

#### 创建文件夹
```bash
curl -X POST http://localhost:3000/api/folders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alias": "测试文件夹"}'
```
预期: 返回新创建的文件夹

#### 获取文件夹详情
```bash
curl -X GET http://localhost:3000/api/folders/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```
预期: 返回文件夹详情

#### 获取子文件夹
```bash
curl -X GET http://localhost:3000/api/folders/1/subfolders \
  -H "Authorization: Bearer YOUR_TOKEN"
```
预期: 返回子文件夹列表

#### 删除文件夹
```bash
curl -X DELETE http://localhost:3000/api/folders/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```
预期: 返回删除成功消息

### 文件操作 (fileRoutes.js)

#### 获取文件列表
```bash
curl -X GET http://localhost:3000/api/folders/1/files \
  -H "Authorization: Bearer YOUR_TOKEN"
```
预期: 返回文件列表

#### 上传文件
通过前端界面测试：
1. 登录系统
2. 进入文件夹
3. 点击上传
4. 选择文件
5. 确认上传成功

预期:
- ✅ 文件上传成功
- ✅ 显示在文件列表中
- ✅ 重复文件检测工作

#### 下载文件
```bash
curl -X GET "http://localhost:3000/api/folders/1/download/filename.txt" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded.txt
```
预期: 文件下载成功

#### 通过ID下载文件
```bash
curl -X GET "http://localhost:3000/api/folders/1/download/by-id/1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded.txt
```
预期: 文件下载成功

#### 删除文件
```bash
curl -X DELETE http://localhost:3000/api/folders/1/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.txt"}'
```
预期: 文件移至回收站

#### 移动文件
```bash
curl -X POST http://localhost:3000/api/folders/1/move \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.txt", "targetFolderId": 2}'
```
预期: 文件移动成功

### 图片预览 (imageRoutes.js)

#### 获取图片预览
```bash
curl -X GET "http://localhost:3000/api/folders/1/preview/image.jpg?width=800&height=600" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o preview.jpg
```
预期: 返回缩略图

#### 通过ID获取图片预览
```bash
curl -X GET "http://localhost:3000/api/folders/1/preview/by-id/1?width=800&height=600" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o preview.jpg
```
预期: 返回缩略图

#### EXIF旋转测试
1. 上传手机拍摄的照片
2. 查看预览
3. 确认方向正确

预期: 图片方向自动修正

### 分片上传 (chunkUploadRoutes.js)

#### 初始化分片上传
```bash
curl -X POST http://localhost:3000/api/folders/1/chunk/init \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName": "large-file.zip", "fileSize": 104857600}'
```
预期: 返回 uploadId

#### 上传分片
```bash
curl -X POST http://localhost:3000/api/folders/1/chunk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uploadId": "xxx", "chunkIndex": 0, "chunk": "base64data..."}'
```
预期: 返回成功

#### 完成上传
```bash
curl -X POST http://localhost:3000/api/folders/1/chunk/complete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uploadId": "xxx"}'
```
预期: 文件创建成功

## 前端测试

### 1. 文件夹管理
- [ ] 创建文件夹
- [ ] 查看文件夹
- [ ] 删除文件夹
- [ ] 子文件夹显示

### 2. 文件上传
- [ ] 单文件上传
- [ ] 多文件上传
- [ ] 大文件上传（>100MB）
- [ ] 重复文件检测
- [ ] 上传进度显示

### 3. 文件下载
- [ ] 点击下载
- [ ] 文件名正确
- [ ] 内容完整

### 4. 文件操作
- [ ] 删除文件
- [ ] 移动文件
- [ ] 批量操作

### 5. 图片预览
- [ ] 图片缩略图显示
- [ ] 点击放大
- [ ] 手机照片方向正确
- [ ] 加载速度

### 6. 回收站
- [ ] 查看回收站
- [ ] 恢复文件
- [ ] 永久删除
- [ ] 清空回收站

## 性能测试

### 1. 并发上传
```bash
# 同时上传10个文件
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/folders/1/upload \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -F "files=@test$i.txt" &
done
wait
```

### 2. 大文件上传
- 测试 100MB 文件
- 测试 500MB 文件
- 测试 1GB 文件（如果配置允许）

### 3. 图片预览性能
- 测试 10MB 图片预览
- 测试 50MB 图片预览
- 测试并发预览请求

## 错误处理测试

### 1. 权限测试
- [ ] 访问他人文件夹（应拒绝）
- [ ] 下载他人文件（应拒绝）
- [ ] 删除他人文件（应拒绝）

### 2. 边界测试
- [ ] 上传空文件
- [ ] 上传超大文件
- [ ] 文件名特殊字符
- [ ] 文件名过长

### 3. 异常测试
- [ ] 网络中断恢复
- [ ] 服务器重启
- [ ] 磁盘空间不足

## 回滚测试

如果发现问题：

```bash
# Windows
rollback-routes.bat

# Linux/Mac
./rollback-routes.sh
```

然后重启服务并验证功能恢复。

## 测试报告模板

```
测试日期: ____________________
测试人员: ____________________

功能测试:
- 文件夹管理: [ ] 通过 [ ] 失败
- 文件上传: [ ] 通过 [ ] 失败
- 文件下载: [ ] 通过 [ ] 失败
- 文件操作: [ ] 通过 [ ] 失败
- 图片预览: [ ] 通过 [ ] 失败
- 分片上传: [ ] 通过 [ ] 失败

性能测试:
- 并发上传: [ ] 通过 [ ] 失败
- 大文件上传: [ ] 通过 [ ] 失败
- 图片预览: [ ] 通过 [ ] 失败

错误处理:
- 权限检查: [ ] 通过 [ ] 失败
- 边界测试: [ ] 通过 [ ] 失败
- 异常处理: [ ] 通过 [ ] 失败

问题记录:
1. ________________________________
2. ________________________________
3. ________________________________

结论: [ ] 可以部署 [ ] 需要修复 [ ] 需要回滚
```

## 成功标准

所有测试项通过，系统运行稳定，性能无明显下降。
