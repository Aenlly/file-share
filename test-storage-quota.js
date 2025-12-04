const UserModel = require('./backend/src/models/UserModel');

async function testStorageQuota() {
    console.log('=== 测试存储配额显示 ===\n');
    
    try {
        // 获取所有用户
        const users = await UserModel.getAll();
        
        console.log('用户列表：');
        users.forEach(user => {
            console.log(`\n用户: ${user.username} (ID: ${user.id})`);
            console.log(`  角色: ${user.role}`);
            console.log(`  存储配额 (原始值): ${user.storageQuota}`);
            console.log(`  存储配额 (GB): ${user.storageQuota ? (user.storageQuota / (1024 * 1024 * 1024)).toFixed(2) : '未设置'}`);
            console.log(`  已使用存储: ${user.storageUsed || 0}`);
        });
        
        // 测试格式化函数
        console.log('\n\n=== 测试格式化函数 ===');
        const testValues = [
            0,
            null,
            undefined,
            107374182.4, // 0.1 GB in bytes
            1073741824,  // 1 GB
            10737418240, // 10 GB
        ];
        
        testValues.forEach(val => {
            const formatted = formatStorageSize(val);
            console.log(`${val} => ${formatted}`);
        });
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

function formatStorageSize(bytes) {
    if (bytes === null || bytes === undefined) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

testStorageQuota();
