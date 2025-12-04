# 全局统计API修复

## 问题
前端请求 `GET /api/users/stats-all` 返回 404 错误。

## 原因
后端缺少 `/stats-all` 路由。

## 修复
在 `backend/src/routes/userRoutes.js` 中添加了 `/stats-all` 路由。

### 新增路由
```javascript
router.get('/stats-all', authenticate, requireAdmin, async (req, res, next) => {
  // 获取所有用户的统计信息
  // 仅管理员可访问
})
```

### 返回数据格式
```json
{
  "users": [
    {
      "userId": 1,
      "username": "admin",
      "role": "admin",
      "folders": 5,
      "files": 20,
      "totalSize": 1048576,
      "recycleBin": 1,
      "shares": 3,
      "activeShares": 2
    }
  ],
  "totals": {
    "totalUsers": 10,
    "totalFolders": 50,
    "totalFiles": 200,
    "totalSize": 10485760,
    "totalShares": 30,
    "totalActiveShares": 20
  }
}
```

## 权限
- 需要登录（`authenticate`）
- 需要管理员权限（`requireAdmin`）

## 测试
1. 重启后端服务
2. 使用管理员账号登录
3. 访问仪表盘
4. 应该能看到全局统计数据

## 状态
✅ 已修复

---
**日期**: 2024-12-04
