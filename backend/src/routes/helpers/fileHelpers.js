const crypto = require('crypto');
const FolderModel = require('../../models/FolderModel');

/**
 * 计算文件的 MD5 哈希值
 */
function calculateFileHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * 检查文件夹是否属于用户（包括子文件夹）
 */
async function isFolderOwnedByUser(folderId, username) {
    const folder = await FolderModel.findById(folderId);
    if (!folder) {
        return false;
    }

    // 检查是否是所有者
    if (folder.owner === username) {
        return true;
    }

    // 检查是否是子文件夹（通过遍历父文件夹链）
    let currentFolder = folder;
    const allFolders = await FolderModel.getAll();

    while (currentFolder.parentId) {
        const parentFolder = allFolders.find(f => f.id === currentFolder.parentId);
        if (!parentFolder) {
            break;
        }

        if (parentFolder.owner === username) {
            return true;
        }

        currentFolder = parentFolder;
    }

    return false;
}

module.exports = {
    calculateFileHash,
    isFolderOwnedByUser
};
