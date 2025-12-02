/**
 * 为现有文件添加哈希值
 * 这个脚本会扫描所有已上传的文件，计算它们的哈希值并更新数据库
 */

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const FileModel = require('../src/models/FileModel');
const FolderModel = require('../src/models/FolderModel');
const { FILES_ROOT } = require('../src/utils/fileHelpers');

/**
 * 计算文件的 MD5 哈希值
 */
function calculateFileHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

async function addFileHashes() {
    try {
        console.log('开始为现有文件添加哈希值...\n');

        // 获取所有文件记录
        const files = await FileModel.getAll();
        console.log(`找到 ${files.length} 个文件记录\n`);

        let processed = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const file of files) {
            processed++;
            
            try {
                // 如果已有哈希值，跳过
                if (file.hash) {
                    console.log(`[${processed}/${files.length}] 跳过（已有哈希）: ${file.originalName}`);
                    skipped++;
                    continue;
                }

                // 获取文件夹信息
                const folder = await FolderModel.findById(file.folderId);
                if (!folder) {
                    console.log(`[${processed}/${files.length}] 错误: 文件夹不存在 (ID: ${file.folderId})`);
                    errors++;
                    continue;
                }

                // 构建文件路径
                const filePath = path.join(FILES_ROOT, folder.physicalPath, file.savedName);
                
                // 检查文件是否存在
                if (!await fs.pathExists(filePath)) {
                    console.log(`[${processed}/${files.length}] 错误: 物理文件不存在: ${filePath}`);
                    errors++;
                    continue;
                }

                // 读取文件并计算哈希
                const buffer = await fs.readFile(filePath);
                const hash = calculateFileHash(buffer);

                // 更新数据库记录
                await FileModel.update(file.id, { hash });

                console.log(`[${processed}/${files.length}] ✓ 已更新: ${file.originalName} -> ${hash}`);
                updated++;

            } catch (error) {
                console.error(`[${processed}/${files.length}] 错误: ${file.originalName}`, error.message);
                errors++;
            }
        }

        console.log('\n=== 完成 ===');
        console.log(`总计: ${files.length} 个文件`);
        console.log(`已更新: ${updated} 个`);
        console.log(`已跳过: ${skipped} 个`);
        console.log(`错误: ${errors} 个`);

    } catch (error) {
        console.error('脚本执行失败:', error);
        process.exit(1);
    }
}

// 运行脚本
addFileHashes()
    .then(() => {
        console.log('\n脚本执行成功');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n脚本执行失败:', error);
        process.exit(1);
    });
