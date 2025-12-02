# 分享路由修复 - 单数/复数形式兼容

## 问题
前端访问 `/api/share/6wWSwO` 返回404错误。

## 根本原因
- 后端路由定义：`/shares/:code/files`（复数形式）
- 前端访问：`/share/:code`（单数形式）
- 路径不匹配导致404

## 解决方案
添加单数形式的路由别名，兼容前端的调用。

## 修改内容

### 添加单数形式路由
**文件**：`backend/src/routes/publicShareRoutes.js`

```javascript
/**
 * 获取分享信息（单数形式，用于兼容前端）
 */
router.get('/share/:code', async (req, res, next) => {
    try {
        const { code } = req.params;

        const validation = await ShareModel.validateShare(code);
        if (!validation.valid) {
            return res.status(410).json({ error: validation.reason });
        }

        const share = validation.share;
        const folder = await FolderModel.findById(share.folderId);

        res.json({
            folderId: share.folderId,
            folderAlias: folder ? folder.alias : '未知文件夹',
            code: share.code,
            expireTime: share.expireTime
        });
    } catch (error) {
        next(error);
    }
});
```

## 路由对照表

| 前端调用 | 后端路由 | 状态 |
|---------|---------|------|
| `GET /api/share/:code` | `GET /share/:code` | ✅ 新增 |
| `POST /api/shares/verify` | `POST /shares/verify` | ✅ 已存在 |
| `GET /api/shares/:code/files` | `GET /shares/:code/files` | ✅ 已存在 |
| `GET /api/shares/:code/download/:filename` | `GET /shares/:code/download/:filename` | ✅ 已存在 |
| `GET /api/shares/:code/download-all` | `GET /shares/:code/download-all` | ✅ 已存在 |
| `GET /api/shares/:code/preview/:filename` | `GET /shares/:code/preview/:filename` | ✅ 已存在 |
| `GET /api/shares/:code/subfolders` | `GET /shares/:code/subfolders` | ✅ 已存在 |

## 响应格式

### GET /api/share/:code
```json
{
    "folderId": 1,
    "folderAlias": "测试文件夹",
    "code": "6wWSwO",
    "expireTime": 1764899408000
}
```

## 修改的文件

| 文件 | 修改 | 状态 |
|------|------|------|
| `backend/src/routes/publicShareRoutes.js` | 添加单数形式路由 | ✅ 完成 |

## 完成状态

✅ **单数形式路由** - 添加 `/share/:code` 路由
✅ **兼容性** - 支持前端的单数形式调用
✅ **无语法错误** - 代码通过验证

**现在重启后端服务器，分享功能应该能正常工作了！**

## 相关文档

- `TYPE_CONVERSION_FIX.md` - 类型转换修复
- `MOVE_FILE_COMPLETE.md` - 文件移动功能完整修复
