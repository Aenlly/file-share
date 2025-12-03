/**
 * 构建独立应用程序
 * 使用 pkg 将 Node.js 应用打包成可执行文件
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const rootDir = path.join(__dirname, '..');

console.log('🚀 开始构建应用程序...\n');

// 清理旧的构建文件
if (fs.existsSync(distDir)) {
  console.log('🧹 清理旧的构建文件...');
  fs.removeSync(distDir);
}

// 创建 dist 目录
fs.ensureDirSync(distDir);

// 检查是否安装了 pkg
try {
  execSync('pkg --version', { stdio: 'ignore' });
} catch (error) {
  console.log('📦 安装 pkg...');
  execSync('npm install -g pkg', { stdio: 'inherit' });
}

// 构建不同平台的可执行文件
const platforms = [
  { name: 'Windows', target: 'node18-win-x64', output: 'file-share-win.exe' },
  { name: 'Linux', target: 'node18-linux-x64', output: 'file-share-linux' },
  { name: 'macOS', target: 'node18-macos-x64', output: 'file-share-macos' }
];

platforms.forEach(platform => {
  console.log(`\n📦 构建 ${platform.name} 版本...`);
  try {
    execSync(
      `pkg . --targets ${platform.target} --output dist/${platform.output}`,
      { cwd: rootDir, stdio: 'inherit' }
    );
    console.log(`✅ ${platform.name} 版本构建成功`);
  } catch (error) {
    console.error(`❌ ${platform.name} 版本构建失败:`, error.message);
  }
});

// 复制必要的文件到 dist 目录
console.log('\n📋 复制必要的文件...');

const filesToCopy = [
  { src: '.env.example', dest: 'dist/.env.example' },
  { src: 'README.md', dest: 'dist/README.md' },
  { src: 'QUICK_START.md', dest: 'dist/QUICK_START.md' },
  { src: 'DATABASE_ADAPTER_GUIDE.md', dest: 'dist/DATABASE_ADAPTER_GUIDE.md' }
];

filesToCopy.forEach(file => {
  const srcPath = path.join(rootDir, file.src);
  const destPath = path.join(rootDir, file.dest);
  if (fs.existsSync(srcPath)) {
    fs.copySync(srcPath, destPath);
    console.log(`  ✓ ${file.src}`);
  }
});

// 创建必要的目录
const dirsToCreate = ['dist/data', 'dist/files', 'dist/logs'];
dirsToCreate.forEach(dir => {
  fs.ensureDirSync(path.join(rootDir, dir));
  console.log(`  ✓ ${dir}/`);
});

// 创建启动说明文件
const readmeContent = `# 文件分享系统 - 独立应用程序

## 快速开始

### Windows
1. 将 \`.env.example\` 复制为 \`.env\` 并配置
2. 双击运行 \`file-share-win.exe\`
3. 访问 http://localhost:3000

### Linux
1. 将 \`.env.example\` 复制为 \`.env\` 并配置
2. 添加执行权限: \`chmod +x file-share-linux\`
3. 运行: \`./file-share-linux\`
4. 访问 http://localhost:3000

### macOS
1. 将 \`.env.example\` 复制为 \`.env\` 并配置
2. 添加执行权限: \`chmod +x file-share-macos\`
3. 运行: \`./file-share-macos\`
4. 访问 http://localhost:3000

## 配置说明

编辑 \`.env\` 文件进行配置：

\`\`\`env
# 服务器端口
PORT=3000

# 数据库类型 (json/mongodb/mysql/postgresql)
DB_TYPE=json

# JWT密钥
JWT_SECRET=your-secret-key-here

# CORS允许的源
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
\`\`\`

## 目录结构

- \`data/\` - JSON数据库文件（使用JSON数据库时）
- \`files/\` - 上传的文件存储目录
- \`logs/\` - 日志文件目录

## 默认管理员账号

- 用户名: admin
- 密码: admin123

**首次登录后请立即修改密码！**

## 更多信息

查看以下文档了解更多：
- QUICK_START.md - 快速开始指南
- DATABASE_ADAPTER_GUIDE.md - 数据库配置指南

## 技术支持

如有问题，请查看日志文件：\`logs/app.log\`
`;

fs.writeFileSync(path.join(distDir, 'README.txt'), readmeContent);
console.log('  ✓ README.txt');

// 创建 Windows 批处理启动脚本
const winBatchContent = `@echo off
echo Starting File Share System...
echo.

if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo Please edit .env file to configure the application
    echo.
    pause
)

file-share-win.exe
pause
`;

fs.writeFileSync(path.join(distDir, 'start.bat'), winBatchContent);
console.log('  ✓ start.bat');

// 创建 Linux/macOS shell 启动脚本
const unixShellContent = `#!/bin/bash

echo "Starting File Share System..."
echo ""

if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit .env file to configure the application"
    echo ""
    read -p "Press enter to continue..."
fi

# 检测操作系统
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    chmod +x file-share-linux
    ./file-share-linux
elif [[ "$OSTYPE" == "darwin"* ]]; then
    chmod +x file-share-macos
    ./file-share-macos
else
    echo "Unsupported operating system"
    exit 1
fi
`;

fs.writeFileSync(path.join(distDir, 'start.sh'), unixShellContent);
fs.chmodSync(path.join(distDir, 'start.sh'), '755');
console.log('  ✓ start.sh');

console.log('\n✅ 构建完成！');
console.log('\n📦 构建产物位于 dist/ 目录：');
console.log('  - file-share-win.exe (Windows)');
console.log('  - file-share-linux (Linux)');
console.log('  - file-share-macos (macOS)');
console.log('  - start.bat (Windows启动脚本)');
console.log('  - start.sh (Linux/macOS启动脚本)');
console.log('  - README.txt (使用说明)');
console.log('\n🎉 可以将 dist/ 目录打包分发了！');
