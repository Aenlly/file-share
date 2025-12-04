# 仪表盘重新设计

## 改进内容

### 之前的问题
仪表盘显示的是"文件夹管理"，包含文件夹列表和操作按钮，这不符合仪表盘的定位。

### 现在的设计
仪表盘现在显示用户的统计数据，提供数据概览和快捷访问。

## 新功能

### 1. 统计数据展示

仪表盘现在显示6个关键指标：

#### 📁 文件夹
- 显示用户拥有的文件夹总数
- 点击可跳转到文件夹管理页面
- 图标：蓝色文件夹图标

#### 📄 文件
- 显示用户拥有的文件总数
- 图标：绿色文件图标

#### 💾 存储空间
- 显示所有文件占用的总空间
- 自动格式化显示（B, KB, MB, GB, TB）
- 图标：紫色数据库图标

#### 🗑️ 回收站
- 显示回收站中待删除的文件数量
- 点击可跳转到回收站页面
- 图标：红色删除图标

#### 🔗 分享链接
- 显示创建的分享链接总数
- 点击可跳转到分享管理页面
- 图标：橙色分享图标

#### ⏰ 活跃分享
- 显示未过期的分享链接数量
- 点击可跳转到分享管理页面
- 图标：青色时钟图标

### 2. 快捷操作提示

底部显示快捷操作提示卡片，帮助用户了解如何使用系统。

### 3. 自动刷新

统计数据每30秒自动刷新一次，保持数据最新。

### 4. 响应式设计

- 桌面端：3列布局
- 平板端：2列布局
- 移动端：1列布局

## 技术实现

### 后端API

新增统计API端点：

```javascript
GET /api/users/stats
```

**响应示例**：
```json
{
  "folders": 8,
  "files": 45,
  "totalSize": 1048576000,
  "recycleBin": 3,
  "shares": 5,
  "activeShares": 3
}
```

**实现位置**：`backend/src/routes/userRoutes.js`

### 前端组件

**文件**：`frontend/src/pages/Dashboard.jsx`

**主要改动**：
1. 移除文件夹管理功能
2. 添加统计数据查询
3. 使用 Ant Design 的 Statistic 组件展示数据
4. 添加卡片点击跳转功能
5. 添加文件大小格式化函数

## 修改的文件

1. `backend/src/routes/userRoutes.js` - 添加统计API
2. `frontend/src/pages/Dashboard.jsx` - 重新设计仪表盘

## 使用说明

### 查看统计数据

1. 登录系统
2. 点击左侧菜单的"仪表盘"
3. 查看各项统计数据

### 快捷跳转

点击以下卡片可以快速跳转：
- **文件夹** → 文件夹管理页面
- **回收站** → 回收站页面
- **分享链接** → 分享管理页面
- **活跃分享** → 分享管理页面

### 数据刷新

- 自动刷新：每30秒
- 手动刷新：刷新浏览器页面

## 数据计算逻辑

### 文件夹数量
```javascript
const folders = await FolderModel.findByOwner(username);
const folderCount = folders.length;
```

### 文件数量和总大小
```javascript
const files = await FileModel.find({ owner: username });
const fileCount = files.length;
const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
```

### 回收站数量
```javascript
const recycleBinFiles = await RecycleBinModel.findByOwner(username);
const recycleBinCount = recycleBinFiles.length;
```

### 分享链接数量
```javascript
const shares = await ShareModel.find({ owner: username });
const shareCount = shares.length;
```

### 活跃分享数量
```javascript
const now = new Date().toISOString();
const activeShares = shares.filter(share => share.expireTime > now);
const activeShareCount = activeShares.length;
```

## 文件大小格式化

```javascript
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
```

**示例**：
- 0 → "0 B"
- 1024 → "1 KB"
- 1048576 → "1 MB"
- 1073741824 → "1 GB"

## 性能优化

### 1. 数据缓存
使用 React Query 缓存统计数据，减少不必要的请求。

### 2. 自动刷新
```javascript
refetchInterval: 30000 // 每30秒刷新一次
```

### 3. 条件查询
```javascript
enabled: !!user // 只有用户登录时才执行查询
```

## 样式特点

### 卡片悬停效果
```javascript
hoverable
```

### 可点击卡片
```javascript
onClick={() => navigate('/path')}
style={{ cursor: 'pointer' }}
```

### 颜色方案
- 文件夹：蓝色 (#1890ff)
- 文件：绿色 (#52c41a)
- 存储：紫色 (#722ed1)
- 回收站：红色 (#ff4d4f)
- 分享：橙色 (#fa8c16)
- 活跃：青色 (#13c2c2)

## 移动端适配

### 响应式布局
```javascript
<Col xs={24} sm={12} lg={8}>
```

- xs=24：手机端占满整行
- sm=12：平板端占半行
- lg=8：桌面端占1/3行

### 移动端检测
```javascript
const [isMobile, setIsMobile] = useState(false)

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768)
  }
  checkMobile()
  window.addEventListener('resize', checkMobile)
  return () => window.removeEventListener('resize', checkMobile)
}, [])
```

## 测试验证

### 1. 功能测试

1. 登录系统
2. 查看仪表盘
3. 验证统计数据是否正确
4. 点击卡片验证跳转
5. 等待30秒验证自动刷新

### 2. 数据准确性测试

1. 创建几个文件夹
2. 上传几个文件
3. 删除文件到回收站
4. 创建分享链接
5. 刷新仪表盘验证数据

### 3. 响应式测试

1. 在桌面浏览器查看（3列）
2. 调整窗口到平板大小（2列）
3. 调整窗口到手机大小（1列）

## 后续改进建议

### 短期
- [ ] 添加数据趋势图表
- [ ] 添加最近活动列表
- [ ] 添加快捷操作按钮

### 长期
- [ ] 添加存储空间配额显示
- [ ] 添加文件类型分布图
- [ ] 添加访问统计
- [ ] 添加自定义仪表盘布局

## 总结

新的仪表盘设计：
- ✅ 提供清晰的数据概览
- ✅ 支持快捷跳转
- ✅ 自动刷新数据
- ✅ 响应式设计
- ✅ 美观的UI

现在仪表盘真正成为了一个"仪表盘"，而不是文件夹管理页面！
