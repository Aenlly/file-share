# 变更日志 - 2024年12月4日

## [v2.1.1] - 2024-12-04

### 新增功能 ✨

#### 上传配置 API
- 新增 `GET /api/folders/upload/config` 接口
- 返回分片大小和最大文件大小配置
- 支持前端动态获取上传参数

### 问题修复 🐛

#### 回收站层级还原
- **问题：** 子文件夹还原时变成根文件夹，丢失层级关系
- **修复：** 
  - 删除时记录父文件夹的完整信息（名称、物理路径）
  - 实现递归查找和创建父文件夹机制
  - 支持多层级文件夹的正确还原

#### 重复还原冲突
- **问题：** 多次还原同一文件夹导致覆盖
- **修复：** 
  - 自动检测同名文件夹
  - 生成带序号的唯一名称（如：文件夹(1)、文件夹(2)）
  - 保护已还原的数据不被覆盖

#### 代码质量
- 修复 `permissionRoutes.js` 中重复导入 `sendError` 的问题
- 优化错误处理逻辑

### 技术改进 🔧

#### 新增函数
- `generateUniqueFolderName()` - 生成唯一文件夹名称
- `findOrCreateParentFolder()` - 递归查找或创建父文件夹
- 优化 `findOrCreateFolder()` - 使用新的父文件夹处理逻辑

#### 数据模型增强
- `RecycleBinModel.moveFolderToRecycleBin()` 新增 `parentFolder` 参数
- 回收站记录新增字段：
  - `parentFolderAlias` - 父文件夹名称
  - `parentFolderPhysicalPath` - 父文件夹物理路径

### 文档更新 📚

#### 新增文档
- `RECYCLE_BIN_RESTORE_IMPROVEMENT.md` - 还原逻辑优化说明
- `RECYCLE_BIN_HIERARCHY_FIX.md` - 层级还原修复详解
- `RECYCLE_BIN_FINAL_FIX.md` - 最终修复总结
- `LATEST_UPDATES_2024-12-04.md` - 今日更新汇总
- `QUICK_DEPLOY_GUIDE.md` - 快速部署指南

#### 测试脚本
- `test-hierarchy-restore.js` - 层级还原自动化测试
- `test-recycle-restore.js` - 基础还原功能测试

### 修改的文件 📝

#### 后端代码
```
backend/src/routes/folderRoutes.js
  + 新增 GET /upload/config 路由
  + 删除文件夹时获取父文件夹信息

backend/src/routes/recycleBinRoutes.js
  + 新增 generateUniqueFolderName() 函数
  + 新增 findOrCreateParentFolder() 函数
  + 修改 findOrCreateFolder() 函数
  + 优化文件夹还原逻辑
  + 优化文件还原逻辑

backend/src/models/RecycleBinModel.js
  + moveFolderToRecycleBin() 新增 parentFolder 参数
  + 记录父文件夹详细信息

backend/src/routes/permissionRoutes.js
  - 移除重复的 sendError 导入
```

### API 变更 🔌

#### 新增 API
```
GET /api/folders/upload/config
  描述: 获取上传配置信息
  认证: 需要
  响应: { chunkSize: number, maxFileSize: number }
```

#### 修改的 API
```
POST /api/folders/trash/restore/:itemId
  响应消息变化:
  - 文件夹不存在: "文件夹已恢复（包含 X 个文件）"
  - 文件夹已存在: "文件夹已恢复为'文件夹(1)'（包含 X 个文件）"
```

### 测试覆盖 ✅

#### 自动化测试
- ✅ 上传配置 API 测试
- ✅ 两层文件夹层级还原
- ✅ 三层文件夹层级还原
- ✅ 重复还原冲突处理
- ✅ 文件还原到自动创建的文件夹

#### 手动测试场景
- ✅ 子文件夹先还原（父文件夹自动创建）
- ✅ 父文件夹先还原（子文件夹还原到正确位置）
- ✅ 多层级递归还原
- ✅ 部分还原（只还原部分层级）
- ✅ 重复还原（创建带序号的文件夹）

### 兼容性 🔄

#### 向后兼容
- ✅ 旧的回收站数据仍可正常还原
- ✅ 不需要数据库迁移
- ✅ API 保持向后兼容
- ✅ 前端无需修改（上传配置 API 为可选）

#### 数据兼容
- 旧数据：通过 `folderParentId` 查找父文件夹
- 新数据：优先使用 `parentFolderPhysicalPath` 查找
- 降级策略：找不到时创建为根文件夹

### 性能影响 ⚡

#### 性能考虑
- 递归创建父文件夹可能需要多次数据库操作
- 深层级结构（>5层）可能有轻微延迟
- 建议：限制文件夹层级深度为 10 层

#### 优化建议
- 批量还原时共享父文件夹创建
- 缓存物理路径查找结果
- 添加并发控制防止重复创建

### 部署说明 🚀

#### 部署步骤
1. 备份 `data` 目录
2. 更新代码
3. 重启服务
4. 运行测试验证

#### 环境变量（可选）
```bash
CHUNK_SIZE=5242880        # 分片大小，默认 5MB
MAX_FILE_SIZE=104857600   # 最大文件大小，默认 100MB
```

#### 回滚方案
如有问题可快速回滚：
1. 停止服务
2. 恢复数据备份
3. 回退代码到上一版本
4. 重启服务

### 已知限制 ⚠️

1. **并发还原** - 多用户同时还原可能创建重复父文件夹
2. **深层递归** - 极深的层级（>10层）可能影响性能
3. **路径变化** - 手动修改文件夹结构可能影响查找

### 后续计划 🎯

#### 短期（1-2周）
- [ ] 添加还原预览功能
- [ ] 优化批量还原性能
- [ ] 添加还原进度提示

#### 中期（1个月）
- [ ] 实现智能合并选项
- [ ] 添加还原历史记录
- [ ] 支持撤销还原操作

#### 长期（3个月）
- [ ] 文件夹版本控制
- [ ] 增量备份和还原
- [ ] 还原策略配置

### 贡献者 👥

- 开发：Kiro AI Assistant
- 测试：自动化测试 + 手动验证
- 文档：完整的技术文档和部署指南

### 相关链接 🔗

- [完整修复说明](RECYCLE_BIN_FINAL_FIX.md)
- [层级还原详解](RECYCLE_BIN_HIERARCHY_FIX.md)
- [快速部署指南](QUICK_DEPLOY_GUIDE.md)
- [测试脚本](test-hierarchy-restore.js)

---

**发布日期：** 2024-12-04  
**版本号：** v2.1.1  
**状态：** 稳定版，已测试  
**推荐：** 建议所有用户更新
