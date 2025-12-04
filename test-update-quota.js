const UserModel = require('./backend/src/models/UserModel');

async function testUpdateQuota() {
    console.log('=== 测试更新存储配额 ===\n');
    
    try {
        // 获取admin用户
        const admin = await UserModel.findByUsername('admin');
        console.log('当前admin用户信息:');
        console.log(`  ID: ${admin.id}`);
        console.log(`  用户名: ${admin.username}`);
        console.log(`  当前配额: ${admin.storageQuota} 字节`);
        console.log(`  当前配额: ${(admin.storageQuota / (1024 * 1024 * 1024)).toFixed(4)} GB\n`);
        
        // 更新配额为0.05GB
        const newQuotaGB = 0.05;
        const newQuotaBytes = newQuotaGB * 1024 * 1024 * 1024;
        
        console.log(`准备更新配额为: ${newQuotaGB} GB (${newQuotaBytes} 字节)`);
        
        await UserModel.updateStorageQuota(admin.id, newQuotaBytes);
        
        console.log('✅ 配额更新成功\n');
        
        // 验证更新
        const updatedAdmin = await UserModel.findByUsername('admin');
        console.log('更新后的admin用户信息:');
        console.log(`  ID: ${updatedAdmin.id}`);
        console.log(`  用户名: ${updatedAdmin.username}`);
        console.log(`  新配额: ${updatedAdmin.storageQuota} 字节`);
        console.log(`  新配额: ${(updatedAdmin.storageQuota / (1024 * 1024 * 1024)).toFixed(4)} GB`);
        
        if (updatedAdmin.storageQuota === newQuotaBytes) {
            console.log('\n✅ 配额更新验证成功！');
        } else {
            console.log('\n❌ 配额更新验证失败！');
            console.log(`  期望: ${newQuotaBytes}`);
            console.log(`  实际: ${updatedAdmin.storageQuota}`);
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

testUpdateQuota();
