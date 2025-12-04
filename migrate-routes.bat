@echo off
echo ========================================
echo 路由重构迁移脚本
echo ========================================
echo.

echo [1/5] 备份原文件...
copy backend\src\routes\folderRoutes.js backend\src\routes\folderRoutes.backup.js
if errorlevel 1 (
    echo 错误: 备份失败
    exit /b 1
)
echo 备份完成: folderRoutes.backup.js
echo.

echo [2/5] 验证新文件存在...
if not exist backend\src\routes\folderRoutes.new.js (
    echo 错误: folderRoutes.new.js 不存在
    exit /b 1
)
if not exist backend\src\routes\imageRoutes.js (
    echo 错误: imageRoutes.js 不存在
    exit /b 1
)
if not exist backend\src\routes\fileRoutes.js (
    echo 错误: fileRoutes.js 不存在
    exit /b 1
)
if not exist backend\src\routes\chunkUploadRoutes.js (
    echo 错误: chunkUploadRoutes.js 不存在
    exit /b 1
)
if not exist backend\src\routes\helpers\fileHelpers.js (
    echo 错误: helpers\fileHelpers.js 不存在
    exit /b 1
)
echo 所有新文件验证通过
echo.

echo [3/5] 替换主路由文件...
del backend\src\routes\folderRoutes.js
move backend\src\routes\folderRoutes.new.js backend\src\routes\folderRoutes.js
if errorlevel 1 (
    echo 错误: 文件替换失败，正在回滚...
    copy backend\src\routes\folderRoutes.backup.js backend\src\routes\folderRoutes.js
    exit /b 1
)
echo 文件替换成功
echo.

echo [4/5] 验证语法...
node -c backend\src\routes\folderRoutes.js
if errorlevel 1 (
    echo 错误: 语法检查失败，正在回滚...
    copy backend\src\routes\folderRoutes.backup.js backend\src\routes\folderRoutes.js
    exit /b 1
)
node -c backend\src\routes\imageRoutes.js
node -c backend\src\routes\fileRoutes.js
node -c backend\src\routes\chunkUploadRoutes.js
node -c backend\src\routes\helpers\fileHelpers.js
echo 语法检查通过
echo.

echo [5/5] 迁移完成！
echo.
echo ========================================
echo 下一步操作:
echo 1. 重启后端服务: cd backend ^&^& npm start
echo 2. 测试所有功能
echo 3. 如有问题，运行 rollback-routes.bat 回滚
echo ========================================
echo.
pause
