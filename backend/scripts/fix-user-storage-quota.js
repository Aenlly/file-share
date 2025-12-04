const fs = require('fs-extra');
const path = require('path');

async function fixUserStorageQuota() {
    console.log('=== 修复用户存储配额 ===\n');
    
    const usersFile = path.join(__dirname, '../data/users.json');
    
    try {
        // 读取用户数据
        const users = await fs.readJson(usersFile);
        console.log(`找到 ${users.length} 个用户\n`);
        
        let updated = false;
        
        // 为每个用户添加默认存储配额（如果缺失）
        users.forEach(user => {
            if (!user.storageQuota) {
                const defaultQuota = 10 * 1024 * 1024 * 1024; // 10GB
                user.storageQuota = defaultQuota;
                user.storageUsed = user.storageUsed || 0;
                console.log(`✓ 为用户 ${user.username} 设置默认配额: 10 GB`);
                updated = true;
            } else {
                const quotaGB = (user.storageQuota / (1024 * 1024 * 1024)).toFixed(2);
                console.log(`✓ 用户 ${user.username} 已有配额: ${quotaGB} GB`);
            }
            
            // 确保有 storageUsed 字段
            if (user.storageUsed === undefined) {
                user.storageUsed = 0;
                updated = true;
            }
        });
        
        if (updated) {
            // 保存更新后的数据
            await fs.writeJson(usersFile, users, { spaces: 2 });
            console.log('\n✅ 用户存储配额已更新');
        } else {
            console.log('\n✅ 所有用户配额已正确设置');
        }
        
    } catch (error) {
        console.error('❌ 修复失败:', error);
    }
}

fixUserStorageQuota();
