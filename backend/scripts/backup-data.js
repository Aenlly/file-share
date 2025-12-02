#!/usr/bin/env node

/**
 * 数据备份脚本
 * 支持备份所有数据库类型的数据
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');

const config = require('../src/config');

/**
 * 备份JSON数据
 */
async function backupJson() {
    console.log('\n📦 备份JSON数据...');

    const dataDir = config.database.json.dataDir;
    const backupDir = path.join(process.cwd(), 'backups', `json-${Date.now()}`);

    try {
        await fs.ensureDir(backupDir);
        await fs.copy(dataDir, backupDir);
        console.log(`✅ JSON数据已备份到: ${backupDir}`);
        return backupDir;
    } catch (error) {
        console.error(`❌ JSON备份失败: ${error.message}`);
        throw error;
    }
}

/**
 * 备份MongoDB数据
 */
async function backupMongoDB() {
    console.log('\n📦 备份MongoDB数据...');

    const uri = config.database.mongodb.uri;
    const backupDir = path.join(process.cwd(), 'backups', `mongodb-${Date.now()}`);

    try {
        await fs.ensureDir(backupDir);

        // 使用mongodump命令
        const command = `mongodump --uri="${uri}" --out="${backupDir}"`;
        execSync(command, { stdio: 'inherit' });

        console.log(`✅ MongoDB数据已备份到: ${backupDir}`);
        return backupDir;
    } catch (error) {
        console.error(`❌ MongoDB备份失败: ${error.message}`);
        throw error;
    }
}

/**
 * 备份MySQL数据
 */
async function backupMySQL() {
    console.log('\n📦 备份MySQL数据...');

    const { host, port, user, password, database } = config.database.mysql;
    const backupDir = path.join(process.cwd(), 'backups', `mysql-${Date.now()}`);
    const backupFile = path.join(backupDir, `${database}.sql`);

    try {
        await fs.ensureDir(backupDir);

        // 使用mysqldump命令
        const command = `mysqldump -h ${host} -P ${port} -u ${user} ${password ? `-p${password}` : ''} ${database} > "${backupFile}"`;
        execSync(command, { stdio: 'inherit' });

        console.log(`✅ MySQL数据已备份到: ${backupFile}`);
        return backupDir;
    } catch (error) {
        console.error(`❌ MySQL备份失败: ${error.message}`);
        throw error;
    }
}

/**
 * 备份PostgreSQL数据
 */
async function backupPostgreSQL() {
    console.log('\n📦 备份PostgreSQL数据...');

    const { host, port, user, password, database } = config.database.postgresql;
    const backupDir = path.join(process.cwd(), 'backups', `postgresql-${Date.now()}`);
    const backupFile = path.join(backupDir, `${database}.sql`);

    try {
        await fs.ensureDir(backupDir);

        // 使用pg_dump命令
        const env = { ...process.env };
        if (password) {
            env.PGPASSWORD = password;
        }

        const command = `pg_dump -h ${host} -p ${port} -U ${user} ${database} > "${backupFile}"`;
        execSync(command, { stdio: 'inherit', env });

        console.log(`✅ PostgreSQL数据已备份到: ${backupFile}`);
        return backupDir;
    } catch (error) {
        console.error(`❌ PostgreSQL备份失败: ${error.message}`);
        throw error;
    }
}

/**
 * 备份文件
 */
async function backupFiles() {
    console.log('\n📦 备份上传的文件...');

    const filesDir = path.join(process.cwd(), 'files');
    const backupDir = path.join(process.cwd(), 'backups', `files-${Date.now()}`);

    try {
        if (await fs.pathExists(filesDir)) {
            await fs.ensureDir(backupDir);
            await fs.copy(filesDir, backupDir);
            console.log(`✅ 文件已备份到: ${backupDir}`);
            return backupDir;
        } else {
            console.log('⚠️  文件目录不存在，跳过备份');
            return null;
        }
    } catch (error) {
        console.error(`❌ 文件备份失败: ${error.message}`);
        throw error;
    }
}

/**
 * 清理旧备份
 */
async function cleanupOldBackups(days = 7) {
    console.log(`\n🧹 清理 ${days} 天前的备份...\n`);

    const backupsDir = path.join(process.cwd(), 'backups');
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    try {
        if (!await fs.pathExists(backupsDir)) {
            console.log('备份目录不存在');
            return;
        }

        const backups = await fs.readdir(backupsDir);
        let deletedCount = 0;

        for (const backup of backups) {
            const backupPath = path.join(backupsDir, backup);
            const stats = await fs.stat(backupPath);

            if (stats.mtimeMs < cutoffTime) {
                await fs.remove(backupPath);
                console.log(`✅ 已删除: ${backup}`);
                deletedCount++;
            }
        }

        console.log(`\n✅ 清理完成，删除了 ${deletedCount} 个旧备份\n`);
    } catch (error) {
        console.error(`❌ 清理失败: ${error.message}`);
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('\n💾 文件分享系统 - 数据备份工具\n');

    const dbType = config.database.type.toLowerCase();
    const backupDirs = [];

    try {
        // 备份数据库
        switch (dbType) {
            case 'json':
                backupDirs.push(await backupJson());
                break;
            case 'mongodb':
                backupDirs.push(await backupMongoDB());
                break;
            case 'mysql':
                backupDirs.push(await backupMySQL());
                break;
            case 'postgresql':
                backupDirs.push(await backupPostgreSQL());
                break;
            default:
                throw new Error(`不支持的数据库类型: ${dbType}`);
        }

        // 备份文件
        const filesBackup = await backupFiles();
        if (filesBackup) {
            backupDirs.push(filesBackup);
        }

        // 清理旧备份
        await cleanupOldBackups(7);

        console.log('🎉 备份完成！\n');
        console.log('备份位置:');
        backupDirs.forEach(dir => console.log(`  - ${dir}`));
        console.log();
    } catch (error) {
        console.error('❌ 备份失败:', error.message);
        process.exit(1);
    }
}

main();
