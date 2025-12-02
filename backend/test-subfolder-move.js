/**
 * 测试子文件夹中的文件移动到父文件夹
 */

const FolderModel = require('./src/models/FolderModel');
const FileModel = require('./src/models/FileModel');

async function testSubfolderMove() {
    try {
        console.log('=== 测试子文件夹文件移动 ===\n');

        // 模拟用户
        const username = 'testuser';

        // 1. 创建父文件夹
        console.log('1. 创建父文件夹...');
        const parentFolder = await FolderModel.create({
            alias: '父文件夹',
            parentId: null,
            owner: username
        });
        console.log(`   ✓ 父文件夹创建成功: ID=${parentFolder.id}, alias=${parentFolder.alias}\n`);

        // 2. 创建子文件夹
        console.log('2. 创建子文件夹...');
        const childFolder = await FolderModel.create({
            alias: '子文件夹',
            parentId: parentFolder.id,
            owner: username
        });
        console.log(`   ✓ 子文件夹创建成功: ID=${childFolder.id}, alias=${childFolder.alias}, parentId=${childFolder.parentId}\n`);

        // 3. 在子文件夹中创建文件记录
        console.log('3. 在子文件夹中创建文件...');
        const file = await FileModel.create({
            folderId: childFolder.id,
            originalName: 'test.txt',
            savedName: 'test_1234.txt',
            size: 1024,
            mimeType: 'text/plain',
            owner: username
        });
        console.log(`   ✓ 文件创建成功: ID=${file.id}, originalName=${file.originalName}, folderId=${file.folderId}\n`);

        // 4. 测试权限检查函数
        console.log('4. 测试权限检查...');
        
        // 模拟权限检查函数
        async function isFolderOwnedByUser(folderId, user) {
            const folder = await FolderModel.findById(folderId);
            if (!folder) return false;

            if (folder.owner === user) return true;

            let currentFolder = folder;
            const allFolders = await FolderModel.getAll();

            while (currentFolder.parentId) {
                const parentFolder = allFolders.find(f => f.id === currentFolder.parentId);
                if (!parentFolder) break;

                if (parentFolder.owner === user) return true;

                currentFolder = parentFolder;
            }

            return false;
        }

        // 检查子文件夹权限
        const childHasAccess = await isFolderOwnedByUser(childFolder.id, username);
        console.log(`   ✓ 子文件夹权限检查: ${childHasAccess ? '✓ 有权限' : '✗ 无权限'}`);

        // 检查父文件夹权限
        const parentHasAccess = await isFolderOwnedByUser(parentFolder.id, username);
        console.log(`   ✓ 父文件夹权限检查: ${parentHasAccess ? '✓ 有权限' : '✗ 无权限'}\n`);

        // 5. 模拟文件移动
        console.log('5. 模拟文件移动...');
        if (childHasAccess && parentHasAccess) {
            await FileModel.update(file.id, { folderId: parentFolder.id });
            const updatedFile = await FileModel.findById(file.id);
            console.log(`   ✓ 文件移动成功: 新的folderId=${updatedFile.folderId}\n`);
        } else {
            console.log(`   ✗ 权限检查失败，无法移动文件\n`);
        }

        // 6. 验证结果
        console.log('6. 验证结果...');
        const filesInParent = await FileModel.findByFolder(parentFolder.id);
        const filesInChild = await FileModel.findByFolder(childFolder.id);
        console.log(`   ✓ 父文件夹中的文件数: ${filesInParent.length}`);
        console.log(`   ✓ 子文件夹中的文件数: ${filesInChild.length}\n`);

        console.log('=== 测试完成 ===');
    } catch (error) {
        console.error('测试失败:', error.message);
        console.error(error);
    }
}

// 运行测试
testSubfolderMove();
