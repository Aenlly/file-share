/**
 * 迁移脚本：将用户文件夹从 username 格式迁移到 id-username 格式
 * 
 * 使用方法：
 * node backend/scripts/migrate-user-folders.js
 */

const fs = require('fs-extra');
const path = require('path');

// 动态加载配置和模型
const config = require('../src/config');
const UserModel = require('../src/models/UserModel');
const FolderModel = require('../src/models/FolderModel');

const FILES_ROOT = path.join(process.cwd(), 'files');

async function migrateUserFolders() {
    console.log('开始迁移用户文件夹...\n');
    
    try {
        // 获取所有用户
        const users = await UserModel.getAll();
        console.log(`找到 ${users.length} 个用户\n`);
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        
        for (const user of users) {
            const oldPath = path.join(FILES_ROOT, user.username);
            const newPath = path.join(FILES_ROOT, `${user.id}-${user.username}`);
            
            console.log(`处理用户: ${user.username} (ID: ${user.id})`);
            console.log(`  旧路径: ${oldPath}`);
            console.log(`  新路径: ${newPath}`);
            
            // 检查旧路径是否存在
            if (!await fs.pathExists(oldPath)) {
                console.log(`  ⚠ 跳过：旧路径不存在\n`);
                skipCount++;
                continue;
            }
            
            // 检查新路径是否已存在
            if (await fs.pathExists(newPath)) {
                console.log(`  ⚠ 跳过：新路径已存在\n`);
                skipCount++;
                continue;
            }
            
            try {
                // 重命名文件夹
                await fs.move(oldPath, newPath);
                console.log(`  ✓ 成功迁移\n`);
                successCount++;
            } catch (error) {
                console.error(`  ✗ 迁移失败: ${error.message}\n`);
                errorCount++;
            }
        }
        
        console.log('='.repeat(50));
        console.log('迁移完成！');
        console.log(`成功: ${successCount} 个`);
        console.log(`跳过: ${skipCount} 个`);
        console.log(`失败: ${errorCount} 个`);
        console.log('='.repeat(50));
        
        // 更新数据库中的 physicalPath
        if (successCount > 0) {
            console.log('\n正在更新数据库中的文件夹路径...');
            await updateFolderPaths();
            console.log('数据库更新完成！');
        }
        
    } catch (error) {
        console.error('迁移过程中发生错误:', error);
        process.exit(1);
    }
}

async function updateFolderPaths() {
    try {
        const folders = await FolderModel.getAll();
        const users = await UserModel.getAll();
        
        // 创建用户名到用户ID的映射
        const usernameToId = {};
        users.forEach(user => {
            usernameToId[user.username] = user.id;
        });
        
        let updateCount = 0;
        
        for (const folder of folders) {
            const userId = usernameToId[folder.owner];
            if (!userId) {
                console.log(`  警告: 找不到用户 ${folder.owner} 的ID`);
                continue;
            }
            
            // 检查 physicalPath 是否以旧格式开头
            if (folder.physicalPath.startsWith(`${folder.owner}/`)) {
                const newPhysicalPath = folder.physicalPath.replace(
                    `${folder.owner}/`,
                    `${userId}-${folder.owner}/`
                );
                
                // 更新数据库记录
                await FolderModel.update(folder.id, { physicalPath: newPhysicalPath });
                console.log(`  更新文件夹: ${folder.alias} (${folder.physicalPath} -> ${newPhysicalPath})`);
                updateCount++;
            }
        }
        
        console.log(`共更新 ${updateCount} 个文件夹路径`);
        
    } catch (error) {
        console.error('更新数据库路径失败:', error);
        throw error;
    }
}

// 运行迁移
migrateUserFolders()
    .then(() => {
        console.log('\n迁移脚本执行完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n迁移脚本执行失败:', error);
        process.exit(1);
    });
