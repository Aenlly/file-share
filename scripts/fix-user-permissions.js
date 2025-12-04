/**
 * 修复现有用户的权限
 * 为所有没有 permissions 字段的用户分配默认权限
 * 
 * 使用方法：
 * node fix-user-permissions.js
 */

const path = require('path');
const fs = require('fs-extra');

// 配置
const DATA_DIR = path.join(__dirname, 'backend', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// 权限预设
const ROLE_PRESETS = {
    admin: [
        'dashboard:view:own', 'dashboard:view:all', 'dashboard:view:user',
        'folder:view:own', 'folder:create:own', 'folder:update:own', 'folder:delete:own', 'folder:manage:all',
        'file:view:own', 'file:upload:own', 'file:download:own', 'file:delete:own', 'file:manage:all',
        'share:create:own', 'share:view:own', 'share:delete:own', 'share:manage:all',
        'recycle:view:own', 'recycle:restore:own', 'recycle:delete:own', 'recycle:manage:all',
        'user:view:list', 'user:create', 'user:update:own', 'user:update:any', 'user:delete',
        'user:password:own', 'user:password:any',
        'permission:view', 'permission:manage'
    ],
    user: [
        'dashboard:view:own',
        'folder:view:own', 'folder:create:own', 'folder:update:own', 'folder:delete:own',
        'file:view:own', 'file:upload:own', 'file:download:own', 'file:delete:own',
        'share:create:own', 'share:view:own', 'share:delete:own',
        'recycle:view:own', 'recycle:restore:own', 'recycle:delete:own',
        'user:update:own', 'user:password:own'
    ],
    manager: [
        'dashboard:view:own', 'dashboard:view:all', 'dashboard:view:user',
        'folder:view:own', 'folder:create:own', 'folder:update:own', 'folder:delete:own',
        'file:view:own', 'file:upload:own', 'file:download:own', 'file:delete:own',
        'share:create:own', 'share:view:own', 'share:delete:own',
        'recycle:view:own', 'recycle:restore:own', 'recycle:delete:own',
        'user:view:list', 'user:update:own', 'user:password:own'
    ],
    readonly: [
        'dashboard:view:own',
        'folder:view:own',
        'file:view:own', 'file:download:own',
        'user:update:own', 'user:password:own'
    ]
};

async function fixUserPermissions() {
    try {
        console.log('========================================');
        console.log('   修复用户权限');
        console.log('========================================\n');

        // 检查文件是否存在
        if (!await fs.pathExists(USERS_FILE)) {
            console.log('❌ 用户文件不存在:', USERS_FILE);
            return;
        }

        // 读取用户数据
        const usersData = await fs.readJson(USERS_FILE);
        console.log(`📁 找到 ${usersData.length} 个用户\n`);

        let fixedCount = 0;
        let skippedCount = 0;

        // 遍历所有用户
        for (const user of usersData) {
            if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
                console.log(`✓ ${user.username} (${user.role}) - 已有权限，跳过`);
                skippedCount++;
                continue;
            }

            // 根据角色分配权限
            const role = user.role || 'user';
            const permissions = ROLE_PRESETS[role] || ROLE_PRESETS.user;
            
            user.permissions = permissions;
            fixedCount++;
            
            console.log(`✅ ${user.username} (${role}) - 已分配 ${permissions.length} 个权限`);
        }

        // 保存更新后的数据
        if (fixedCount > 0) {
            await fs.writeJson(USERS_FILE, usersData, { spaces: 2 });
            console.log(`\n💾 已保存更新`);
        }

        console.log('\n========================================');
        console.log('   修复完成');
        console.log('========================================');
        console.log(`✅ 修复: ${fixedCount} 个用户`);
        console.log(`⏭️  跳过: ${skippedCount} 个用户`);
        console.log(`📊 总计: ${usersData.length} 个用户\n`);

        if (fixedCount > 0) {
            console.log('⚠️  请重启后端服务器以应用更改\n');
        }

    } catch (error) {
        console.error('❌ 修复失败:', error.message);
        console.error(error);
    }
}

// 运行修复
fixUserPermissions();
