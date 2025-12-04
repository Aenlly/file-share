/**
 * 迁移脚本：为现有用户添加权限字段
 * 
 * 使用方法：
 * cd backend && node scripts/migrate-permissions.js
 * 或从项目根目录：
 * node backend/scripts/migrate-permissions.js
 */

const path = require('path');

// 确保从 backend 目录运行
const isInBackend = process.cwd().endsWith('backend');
if (!isInBackend) {
    process.chdir(path.join(process.cwd(), 'backend'));
    console.log(`切换工作目录到: ${process.cwd()}\n`);
}

require('dotenv').config();

const config = require('../src/config');
const { getDatabaseManager } = require('../src/database/DatabaseManager');
const UserModel = require('../src/models/UserModel');
const { ROLE_PRESETS } = require('../src/config/permissions');

async function migratePermissions() {
    console.log('开始迁移用户权限...\n');
    
    try {
        // 初始化数据库
        console.log('初始化数据库...');
        const dbManager = getDatabaseManager(config);
        await dbManager.initialize();
        console.log('数据库初始化完成\n');

        const users = await UserModel.getAll();
        console.log(`找到 ${users.length} 个用户\n`);
        
        let updateCount = 0;
        let skipCount = 0;
        
        for (const user of users) {
            console.log(`处理用户: ${user.username} (ID: ${user.id}, 角色: ${user.role})`);
            
            // 如果用户已经有 permissions 字段，跳过
            if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
                console.log(`  ⚠ 跳过：已有权限配置 (${user.permissions.length} 个权限)\n`);
                skipCount++;
                continue;
            }
            
            // 根据角色设置默认权限
            const role = user.role || 'user';
            const permissions = ROLE_PRESETS[role] || ROLE_PRESETS.user;
            
            try {
                await UserModel.updatePermissions(user.id, permissions);
                console.log(`  ✓ 成功设置权限 (${permissions.length} 个权限)\n`);
                updateCount++;
            } catch (error) {
                console.error(`  ✗ 设置权限失败: ${error.message}\n`);
            }
        }
        
        console.log('='.repeat(50));
        console.log('迁移完成！');
        console.log(`更新: ${updateCount} 个用户`);
        console.log(`跳过: ${skipCount} 个用户`);
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('迁移过程中发生错误:', error);
        process.exit(1);
    }
}

// 运行迁移
migratePermissions()
    .then(() => {
        console.log('\n迁移脚本执行完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n迁移脚本执行失败:', error);
        process.exit(1);
    });
