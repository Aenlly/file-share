#!/usr/bin/env node

/**
 * 数据库迁移脚本
 * 支持在不同数据库类型之间迁移数据
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');

const JsonAdapter = require('../src/database/adapters/JsonAdapter');
const MongoDbAdapter = require('../src/database/adapters/MongoDbAdapter');
const MysqlAdapter = require('../src/database/adapters/MysqlAdapter');
const PostgresqlAdapter = require('../src/database/adapters/PostgresqlAdapter');

const config = require('../src/config');

// 集合名称
const COLLECTIONS = ['users', 'folders', 'files', 'shares'];

/**
 * 创建适配器实例
 */
function createAdapter(dbType, dbConfig) {
    switch (dbType.toLowerCase()) {
        case 'json':
            return new JsonAdapter(dbConfig);
        case 'mongodb':
            return new MongoDbAdapter(dbConfig);
        case 'mysql':
            return new MysqlAdapter(dbConfig);
        case 'postgresql':
            return new PostgresqlAdapter(dbConfig);
        default:
            throw new Error(`不支持的数据库类型: ${dbType}`);
    }
}

/**
 * 迁移数据
 */
async function migrateData(sourceAdapter, targetAdapter, collections) {
    console.log('\n📊 开始数据迁移...\n');

    let totalRecords = 0;

    for (const collection of collections) {
        try {
            console.log(`📦 迁移集合: ${collection}`);

            // 从源数据库读取数据
            const records = await sourceAdapter.findAll(collection);
            console.log(`   ├─ 读取 ${records.length} 条记录`);

            // 写入目标数据库
            for (const record of records) {
                try {
                    await targetAdapter.insert(collection, record);
                } catch (error) {
                    console.warn(`   ├─ ⚠️  插入失败: ${error.message}`);
                }
            }

            console.log(`   └─ ✅ 迁移完成\n`);
            totalRecords += records.length;
        } catch (error) {
            console.error(`❌ 迁移集合 ${collection} 失败:`, error.message);
        }
    }

    console.log(`\n✅ 数据迁移完成！总共迁移 ${totalRecords} 条记录\n`);
}

/**
 * 主函数
 */
async function main() {
    console.log('\n🔄 文件分享系统 - 数据库迁移工具\n');

    // 获取源和目标数据库类型
    const sourceType = process.argv[2];
    const targetType = process.argv[3];

    if (!sourceType || !targetType) {
        console.log('使用方法:');
        console.log('  node scripts/migrate-db.js <source> <target>\n');
        console.log('支持的数据库类型:');
        console.log('  - json');
        console.log('  - mongodb');
        console.log('  - mysql');
        console.log('  - postgresql\n');
        console.log('示例:');
        console.log('  node scripts/migrate-db.js json mongodb');
        console.log('  node scripts/migrate-db.js mysql postgresql\n');
        process.exit(1);
    }

    if (sourceType === targetType) {
        console.log('❌ 源数据库和目标数据库不能相同\n');
        process.exit(1);
    }

    try {
        // 创建适配器
        console.log(`📌 源数据库: ${sourceType}`);
        console.log(`📌 目标数据库: ${targetType}\n`);

        const sourceAdapter = createAdapter(sourceType, config.database[sourceType]);
        const targetAdapter = createAdapter(targetType, config.database[targetType]);

        // 连接数据库
        console.log('🔗 连接源数据库...');
        await sourceAdapter.connect();
        console.log('✅ 源数据库已连接\n');

        console.log('🔗 连接目标数据库...');
        await targetAdapter.connect();
        console.log('✅ 目标数据库已连接\n');

        // 迁移数据
        await migrateData(sourceAdapter, targetAdapter, COLLECTIONS);

        // 断开连接
        await sourceAdapter.disconnect();
        await targetAdapter.disconnect();

        console.log('🎉 迁移完成！\n');
    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        process.exit(1);
    }
}

main();
