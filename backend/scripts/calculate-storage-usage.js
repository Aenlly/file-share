const fs = require('fs-extra');
const path = require('path');

async function calculateStorageUsage() {
    console.log('=== 计算用户存储使用量 ===\n');
    
    const filesFile = path.join(__dirname, '../data/files.json');
    const usersFile = path.join(__dirname, '../data/users.json');
    
    try {
        // 读取文件和用户数据
        const files = await fs.readJson(filesFile);
        const users = await fs.readJson(usersFile);
        
        console.log(`找到 ${files.length} 个文件`);
        console.log(`找到 ${users.length} 个用户\n`);
        
        // 按用户统计存储使用量
        const storageByUser = {};
        
        files.forEach(file => {
            const owner = file.owner;
            if (!storageByUser[owner]) {
                storageByUser[owner] = {
                    fileCount: 0,
                    totalSize: 0,
                    files: []
                };
            }
            
            const size = file.size || 0;
            storageByUser[owner].fileCount++;
            storageByUser[owner].totalSize += size;
            storageByUser[owner].files.push({
                name: file.originalName,
                size: size
            });
        });
        
        // 显示统计结果
        console.log('存储使用统计：\n');
        Object.keys(storageByUser).forEach(username => {
            const stats = storageByUser[username];
            const sizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
            const sizeGB = (stats.totalSize / (1024 * 1024 * 1024)).toFixed(4);
            
            console.log(`用户: ${username}`);
            console.log(`  文件数: ${stats.fileCount}`);
            console.log(`  总大小: ${stats.totalSize} 字节`);
            console.log(`  总大小: ${sizeMB} MB`);
            console.log(`  总大小: ${sizeGB} GB`);
            console.log(`  文件列表:`);
            stats.files.forEach(f => {
                const fSizeMB = (f.size / (1024 * 1024)).toFixed(2);
                console.log(`    - ${f.name}: ${fSizeMB} MB`);
            });
            console.log('');
        });
        
        // 更新用户的 storageUsed 字段
        let updated = false;
        users.forEach(user => {
            const stats = storageByUser[user.username];
            const newStorageUsed = stats ? stats.totalSize : 0;
            
            if (user.storageUsed !== newStorageUsed) {
                console.log(`更新 ${user.username} 的存储使用量: ${user.storageUsed || 0} -> ${newStorageUsed}`);
                user.storageUsed = newStorageUsed;
                updated = true;
            }
        });
        
        if (updated) {
            await fs.writeJson(usersFile, users, { spaces: 2 });
            console.log('\n✅ 用户存储使用量已更新');
        } else {
            console.log('\n✅ 所有用户存储使用量已是最新');
        }
        
    } catch (error) {
        console.error('❌ 计算失败:', error);
    }
}

calculateStorageUsage();
