@echo off
echo ========================================
echo 路由回滚脚本
echo ========================================
echo.

echo 警告: 此操作将恢复到重构前的状态
echo.
pause

echo [1/2] 检查备份文件...
if not exist backend\src\routes\folderRoutes.backup.js (
    echo 错误: 备份文件不存在
    exit /b 1
)
echo 备份文件存在
echo.

echo [2/2] 恢复原文件...
copy /Y backend\src\routes\folderRoutes.backup.js backend\src\routes\folderRoutes.js
if errorlevel 1 (
    echo 错误: 恢复失败
    exit /b 1
)
echo.

echo ========================================
echo 回滚完成！
echo 已恢复到重构前的状态
echo 请重启后端服务: cd backend ^&^& npm start
echo ========================================
echo.
pause
