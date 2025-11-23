const Share = require('./src/models/Share');
const Folder = require('./src/models/Folder');

console.log('=== 测试游客访问导航功能 ===\n');

// 1. 查看所有分享
console.log('1. 所有分享链接:');
const shares = Share.getAll();
shares.forEach(share => {
    console.log(`   - 分享码: ${share.code}, 文件夹ID: ${share.folderId}, 所有者: ${share.owner}`);
});

// 2. 查看文件夹层级结构
console.log('\n2. 文件夹层级结构:');
const folders = Folder.getAll();
folders.forEach(folder => {
    const indent = '  '.repeat(folder.parentId ? 1 : 0);
    console.log(`   ${indent}- ${folder.alias}(${folder.id}) ${folder.parentId ? `[父级: ${folder.parentId}]` : '[根级]'}`);
});

// 3. 模拟后端返回的父文件夹信息
console.log('\n3. 父文件夹信息测试:');

// 找到一个有子文件夹的根文件夹
const rootFolders = folders.filter(f => !f.parentId);
if (rootFolders.length > 0) {
    const rootFolder = rootFolders[0];
    console.log(`   根文件夹: ${rootFolder.alias}(${rootFolder.id})`);
    
    // 查找子文件夹
    const subFolders = folders.filter(f => f.parentId === rootFolder.id);
    if (subFolders.length > 0) {
        const subFolder = subFolders[0];
        console.log(`   子文件夹: ${subFolder.alias}(${subFolder.id})`);
        
        // 模拟后端逻辑
        const targetFolderId = subFolder.id;
        const shareFolderId = rootFolder.id;
        
        let parentFolder = null;
        if (targetFolderId !== shareFolderId && subFolder.parentId) {
            parentFolder = folders.find(f => f.id === subFolder.parentId);
            if (parentFolder) {
                parentFolder = {
                    id: parentFolder.id,
                    alias: parentFolder.alias
                };
            }
        }
        
        console.log(`   父文件夹信息: ${parentFolder ? `${parentFolder.alias}(${parentFolder.id})` : '无'}`);
        console.log(`   是否为根文件夹: ${targetFolderId === shareFolderId}`);
    }
}

console.log('\n=== 修复说明 ===');
console.log('1. 后端添加了parentFolder和isRootFolder字段');
console.log('2. 前端使用currentFolderId状态而不是URL参数');
console.log('3. 返回上级按钮现在会正确返回到父文件夹');
console.log('4. 返回根目录按钮会返回到分享的根文件夹');