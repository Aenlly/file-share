#!/usr/bin/env node

/**
 * 版本检查脚本
 * 检查系统依赖和配置
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🔍 文件分享系统 v2.0 - 版本检查\n');

// 检查Node.js版本
console.log('📦 检查Node.js版本...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion >= 16) {
    console.log(`✅ Node.js ${nodeVersion} (满足要求 >= 16.0.0)`);
} else {
    console.log(`❌ Node.js ${nodeVersion} (需要 >= 16.0.0)`);
    process.exit(1);
}

// 检查npm版本
console.log('\n📦 检查npm版本...');
try {
    const npmVersion = execSync('npm -v', { encoding: 'utf8' }).trim();
    console.log(`✅ npm ${npmVersion}`);
} catch (error) {
    console.log('❌ npm未安装');
    process.exit(1);
}

// 检查依赖
console.log('\n📦 检查依赖...');
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const dependencies = packageJson.dependencies;

let missingDeps = [];
for (const [dep, version] of Object.entries(dependencies)) {
    const depPath = path.join(__dirname, '../node_modules', dep);
    if (fs.existsSync(depPath)) {
        console.log(`✅ ${dep}`);
    } else {
        console.log(`❌ ${dep} (未安装)`);
        missingDeps.push(dep);
    }
}

if (missingDeps.length > 0) {
    console.log(`\n⚠️  缺少 ${missingDeps.length} 个依赖，请运行: npm install`);
    process.exit(1);
}

// 检查环境变量
console.log('\n🔐 检查环境变量...');
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    console.log('✅ .env 文件存在');
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = ['PORT', 'NODE_ENV', 'JWT_SECRET', 'DB_TYPE'];
    
    for (const varName of requiredVars) {
        if (envContent.includes(varName)) {
            console.log(`✅ ${varName} 已配置`);
        } else {
            console.log(`⚠️  ${varName} 未配置`);
        }
    }
} else {
    console.log('⚠️  .env 文件不存在，请复制 .env.example 到 .env');
}

// 检查目录
console.log('\n📁 检查目录...');
const requiredDirs = ['data', 'files', 'logs'];
for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, '../', dir);
    if (fs.existsSync(dirPath)) {
        console.log(`✅ ${dir}/ 目录存在`);
    } else {
        console.log(`⚠️  ${dir}/ 目录不存在，将在启动时创建`);
    }
}

// 检查数据库连接
console.log('\n🗄️  检查数据库配置...');
const config = require('../src/config');
console.log(`✅ 数据库类型: ${config.database.type}`);

// 显示系统信息
console.log('\n📊 系统信息:');
console.log(`✅ 操作系统: ${process.platform}`);
console.log(`✅ Node.js: ${nodeVersion}`);
console.log(`✅ 内存: ${Math.round(require('os').totalmem() / 1024 / 1024 / 1024)}GB`);
console.log(`✅ CPU核心数: ${require('os').cpus().length}`);

// 显示应用信息
console.log('\n📱 应用信息:');
console.log(`✅ 版本: ${packageJson.version}`);
console.log(`✅ 名称: ${packageJson.name}`);
console.log(`✅ 描述: ${packageJson.description}`);

console.log('\n✨ 版本检查完成！\n');
console.log('💡 提示: 运行 "npm start" 启动服务器\n');
