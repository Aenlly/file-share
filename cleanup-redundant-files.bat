@echo off
REM 清理冗余文件脚本 (Windows)

echo ========================================
echo    清理项目冗余文件
echo ========================================
echo.

echo [1/4] 删除冗余路由文件...
if exist "backend\src\routes\chunkUploadRoutes.v2.js" (
    del "backend\src\routes\chunkUploadRoutes.v2.js"
    echo ✓ 已删除 chunkUploadRoutes.v2.js
) else (
    echo - chunkUploadRoutes.v2.js 不存在
)
echo.

echo [2/4] 删除冗余模型文件...
if exist "backend\src\models\User.js" (
    del "backend\src\models\User.js"
    echo ✓ 已删除 User.js
) else (
    echo - User.js 不存在
)

if exist "backend\src\models\File.js" (
    del "backend\src\models\File.js"
    echo ✓ 已删除 File.js
) else (
    echo - File.js 不存在
)

if exist "backend\src\models\Folder.js" (
    del "backend\src\models\Folder.js"
    echo ✓ 已删除 Folder.js
) else (
    echo - Folder.js 不存在
)

if exist "backend\src\models\Share.js" (
    del "backend\src\models\Share.js"
    echo ✓ 已删除 Share.js
) else (
    echo - Share.js 不存在
)
echo.

echo [3/4] 删除冗余API客户端...
if exist "frontend\src\utils\request.js" (
    del "frontend\src\utils\request.js"
    echo ✓ 已删除 request.js
) else (
    echo - request.js 不存在
)
echo.

echo [4/4] 整理测试文件到 scripts 目录...
if not exist "scripts" mkdir scripts

if exist "test-rate-limit.html" (
    move "test-rate-limit.html" "scripts\" >nul 2>&1
    echo ✓ 已移动 test-rate-limit.html
)

if exist "test-storage-quota-check.js" (
    move "test-storage-quota-check.js" "scripts\" >nul 2>&1
    echo ✓ 已移动 test-storage-quota-check.js
)

if exist "test-file-type-validation.md" (
    move "test-file-type-validation.md" "scripts\" >nul 2>&1
    echo ✓ 已移动 test-file-type-validation.md
)

if exist "fix-user-permissions.js" (
    move "fix-user-permissions.js" "scripts\" >nul 2>&1
    echo ✓ 已移动 fix-user-permissions.js
)
echo.

echo ========================================
echo    清理完成！
echo ========================================
echo.
echo 建议：
echo 1. 运行 git status 查看更改
echo 2. 测试应用是否正常运行
echo 3. 提交更改到 Git
echo.
pause
