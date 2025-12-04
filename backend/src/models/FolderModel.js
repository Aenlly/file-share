const fs = require('fs-extra');
const path = require('path');
const BaseModel = require('./BaseModel');
const { FILES_ROOT } = require('../utils/fileHelpers');

/**
 * 文件夹模型
 */
class FolderModel extends BaseModel {
    constructor() {
        super('folders');
    }

    /**
     * 根据所有者查询
     */
    async findByOwner(owner) {
        try {
            return await this.find({ owner });
        } catch (error) {
            console.error(`FolderModel.findByOwner失败: owner=${owner}`, error);
            // 如果是系统繁忙错误，直接抛出
            if (error.message.includes('繁忙') || error.message.includes('重试')) {
                throw error;
            }
            throw new Error(`获取文件夹列表失败，请刷新页面重试`);
        }
    }

    /**
     * 根据父文件夹ID查询
     */
    async findByParentId(parentId, owner = null) {
        try {
            const query = { parentId };
            if (owner !== null) {
                query.owner = owner;
            }
            return await this.find(query);
        } catch (error) {
            console.error(`FolderModel.findByParentId失败: parentId=${parentId}, owner=${owner}`, error);
            throw new Error(`查询子文件夹失败: ${error.message}`);
        }
    }

    /**
     * 创建文件夹
     */
    async create(folderData) {
        try {
            // 获取所有文件夹以确定物理路径
            const allFolders = await this.getAll();

            let parentPhysicalPath = '';
            if (folderData.parentId) {
                const parentFolder = allFolders.find(
                    f => f.id === folderData.parentId && f.owner === folderData.owner
                );
                if (!parentFolder) {
                    throw new Error('父文件夹不存在或无权访问');
                }
                parentPhysicalPath = parentFolder.physicalPath + '/';
            } else {
                parentPhysicalPath = folderData.owner + '/';
            }

            const physicalPath = `${parentPhysicalPath}${Date.now()}`;
            const fullPath = path.join(FILES_ROOT, physicalPath);

            // 创建物理文件夹
            await fs.ensureDir(fullPath);

            // 创建数据库记录
            const newFolder = await this.insert({
                alias: folderData.alias,
                physicalPath,
                owner: folderData.owner,
                parentId: folderData.parentId || null
            });

            return newFolder;
        } catch (error) {
            console.error(`FolderModel.create失败: alias=${folderData.alias}`, error);
            // 如果是系统繁忙错误，直接抛出
            if (error.message.includes('繁忙') || error.message.includes('重试')) {
                throw error;
            }
            throw new Error(`创建文件夹失败，请重试`);
        }
    }

    /**
     * 删除文件夹
     */
    async delete(id, owner) {
        const folder = await this.findById(id);

        if (!folder || folder.owner !== owner) {
            throw new Error('无权删除');
        }

        // 删除物理文件夹（如果有 physicalPath）
        if (folder.physicalPath) {
            const folderPath = path.join(FILES_ROOT, folder.physicalPath);
            if (await fs.pathExists(folderPath)) {
                await fs.remove(folderPath);
            }
        }

        // 删除数据库记录
        return await super.delete(id);
    }

    /**
     * 获取文件夹层级结构
     */
    async getFolderHierarchy(owner) {
        const folders = await this.findByOwner(owner);
        const folderMap = {};
        const rootFolders = [];

        // 创建文件夹映射
        folders.forEach(folder => {
            folderMap[folder.id] = { ...folder, children: [] };
        });

        // 构建层级结构
        folders.forEach(folder => {
            if (folder.parentId && folderMap[folder.parentId]) {
                folderMap[folder.parentId].children.push(folderMap[folder.id]);
            } else {
                rootFolders.push(folderMap[folder.id]);
            }
        });

        return rootFolders;
    }
}

module.exports = new FolderModel();
