/**
 * 构建完整的发布包
 * 包含前端和后端的打包
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const rootDir = __dirname;
const releaseDir = path.join(rootDir, 'release');

console.log('🚀 开始构建完整发布包...\n');

// 清理旧的发布文件
if (fs.existsSync(releaseDir)) {
  console.log('🧹 清理旧的发布文件...');
  fs.removeSync(releaseDir);
}

fs.ensureDirSync(releaseDir);

// 1. 构建前端
console.log('\n📦 步骤 1/3: 构建前端...');
try {
  execSync('npm run build', { 
    cwd: path.join(rootDir, 'frontend'),
    stdio: 'inherit' 
  });
  console.log('✅ 前端构建完成');
} catch (error) {
  console.error('❌ 前端构建失败:', error.message);
  process.exit(1);
}

// 2. 复制前端构建产物到后端
console.log('\n📋 步骤 2/3: 复制前端文件到后端...');
const frontendDist = path.join(rootDir, 'frontend/dist');
const backendPublic = path.join(rootDir, 'backend/public');

if (fs.existsSync(backendPublic)) {
  fs.removeSync(backendPublic);
}

fs.copySync(frontendDist, backendPublic);
console.log('✅ 前端文件复制完成');

// 3. 构建后端可执行文件
console.log('\n📦 步骤 3/3: 构建后端可执行文件...');
try {
  execSync('npm run build', { 
    cwd: path.join(rootDir, 'backend'),
    stdio: 'inherit' 
  });
  console.log('✅ 后端构建完成');
} catch (error) {
  console.error('❌ 后端构建失败:', error.message);
  process.exit(1);
}

// 4. 组织发布包
console.log('\n📦 组织发布包...');

const platforms = [
  { name: 'windows', exe: 'file-share-win.exe', script: 'start.bat' },
  { name: 'linux', exe: 'file-share-linux', script: 'start.sh' },
  { name: 'macos', exe: 'file-share-macos', script: 'start.sh' }
];

platforms.forEach(platform => {
  const platformDir = path.join(releaseDir, `file-share-${platform.name}`);
  fs.ensureDirSync(platformDir);
  
  // 复制可执行文件
  const exePath = path.join(rootDir, 'backend/dist', platform.exe);
  if (fs.existsSync(exePath)) {
    fs.copySync(exePath, path.join(platformDir, platform.exe));
    console.log(`  ✓ ${platform.name}/${platform.exe}`);
  }
  
  // 复制启动脚本
  const scriptPath = path.join(rootDir, 'backend/dist', platform.script);
  if (fs.existsSync(scriptPath)) {
    fs.copySync(scriptPath, path.join(platformDir, platform.script));
    console.log(`  ✓ ${platform.name}/${platform.script}`);
  }
  
  // 复制配置文件和文档
  const filesToCopy = [
    'backend/dist/.env.example',
    'backend/dist/README.txt',
    'DEPLOYMENT_GUIDE.md',
    'README.md'
  ];
  
  filesToCopy.forEach(file => {
    const srcPath = path.join(rootDir, file);
    const fileName = path.basename(file);
    const destPath = path.join(platformDir, fileName);
    if (fs.existsSync(srcPath)) {
      fs.copySync(srcPath, destPath);
    }
  });
  
  // 创建必要的目录
  fs.ensureDirSync(path.join(platformDir, 'data'));
  fs.ensureDirSync(path.join(platformDir, 'files'));
  fs.ensureDirSync(path.join(platformDir, 'logs'));
  
  // 创建 .gitkeep 文件
  fs.writeFileSync(path.join(platformDir, 'data/.gitkeep'), '');
  fs.writeFileSync(path.join(platformDir, 'files/.gitkeep'), '');
  fs.writeFileSync(path.join(platformDir, 'logs/.gitkeep'), '');
  
  console.log(`  ✓ ${platform.name}/ 目录结构创建完成`);
});

// 5. 创建压缩包
console.log('\n📦 创建压缩包...');

const archiver = require('archiver');

platforms.forEach(platform => {
  const platformDir = path.join(releaseDir, `file-share-${platform.name}`);
  const zipPath = path.join(releaseDir, `file-share-${platform.name}.zip`);
  
  if (fs.existsSync(platformDir)) {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`  ✓ ${platform.name}.zip (${sizeMB} MB)`);
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(output);
    archive.directory(platformDir, `file-share-${platform.name}`);
    archive.finalize();
  }
});

// 等待压缩完成
setTimeout(() => {
  console.log('\n✅ 发布包构建完成！');
  console.log('\n📦 发布包位于 release/ 目录：');
  
  const files = fs.readdirSync(releaseDir);
  files.forEach(file => {
    if (file.endsWith('.zip')) {
      const stats = fs.statSync(path.join(releaseDir, file));
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`  - ${file} (${sizeMB} MB)`);
    }
  });
  
  console.log('\n🎉 可以分发这些压缩包了！');
  console.log('\n📖 部署说明请查看 DEPLOYMENT_GUIDE.md');
}, 3000);
