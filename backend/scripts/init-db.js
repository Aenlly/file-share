#!/usr/bin/env node

/**
 * 数据库初始化脚本
 * 为关系型数据库创建必要的表
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { Pool } = require('pg');

const config = require('../src/config');

/**
 * 初始化MySQL数据库
 */
async function initMySQL() {
    console.log('\n📊 初始化MySQL数据库...\n');

    const connection = await mysql.createConnection({
        host: config.database.mysql.host,
        port: config.database.mysql.port,
        user: config.database.mysql.user,
        password: config.database.mysql.password,
        database: config.database.mysql.database
    });

    try {
        // 创建用户表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                menuPermissions JSON,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_username (username)
            )
        `);
        console.log('✅ 用户表已创建');

        // 创建文件夹表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS folders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                alias VARCHAR(255) NOT NULL,
                physicalPath VARCHAR(500) NOT NULL,
                owner VARCHAR(255) NOT NULL,
                parentId INT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_owner (owner),
                INDEX idx_parentId (parentId)
            )
        `);
        console.log('✅ 文件夹表已创建');

        // 创建文件表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS files (
                id INT AUTO_INCREMENT PRIMARY KEY,
                folderId INT NOT NULL,
                originalName VARCHAR(500) NOT NULL,
                savedName VARCHAR(500) NOT NULL,
                size BIGINT NOT NULL,
                mimeType VARCHAR(100),
                owner VARCHAR(255) NOT NULL,
                uploadTime TIMESTAMP,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_folderId (folderId),
                INDEX idx_owner (owner)
            )
        `);
        console.log('✅ 文件表已创建');

        // 创建分享表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS shares (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                folderId INT NOT NULL,
                owner VARCHAR(255) NOT NULL,
                expireTime BIGINT NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_code (code),
                INDEX idx_owner (owner)
            )
        `);
        console.log('✅ 分享表已创建');

        console.log('\n✅ MySQL数据库初始化完成！\n');
    } finally {
        await connection.end();
    }
}

/**
 * 初始化PostgreSQL数据库
 */
async function initPostgreSQL() {
    console.log('\n📊 初始化PostgreSQL数据库...\n');

    const pool = new Pool({
        host: config.database.postgresql.host,
        port: config.database.postgresql.port,
        user: config.database.postgresql.user,
        password: config.database.postgresql.password,
        database: config.database.postgresql.database
    });

    const client = await pool.connect();

    try {
        // 创建用户表
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                menuPermissions JSONB,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        `);
        console.log('✅ 用户表已创建');

        // 创建文件夹表
        await client.query(`
            CREATE TABLE IF NOT EXISTS folders (
                id SERIAL PRIMARY KEY,
                alias VARCHAR(255) NOT NULL,
                physicalPath VARCHAR(500) NOT NULL,
                owner VARCHAR(255) NOT NULL,
                parentId INT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner);
            CREATE INDEX IF NOT EXISTS idx_folders_parentId ON folders(parentId);
        `);
        console.log('✅ 文件夹表已创建');

        // 创建文件表
        await client.query(`
            CREATE TABLE IF NOT EXISTS files (
                id SERIAL PRIMARY KEY,
                folderId INT NOT NULL,
                originalName VARCHAR(500) NOT NULL,
                savedName VARCHAR(500) NOT NULL,
                size BIGINT NOT NULL,
                mimeType VARCHAR(100),
                owner VARCHAR(255) NOT NULL,
                uploadTime TIMESTAMP,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_files_folderId ON files(folderId);
            CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner);
        `);
        console.log('✅ 文件表已创建');

        // 创建分享表
        await client.query(`
            CREATE TABLE IF NOT EXISTS shares (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                folderId INT NOT NULL,
                owner VARCHAR(255) NOT NULL,
                expireTime BIGINT NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_shares_code ON shares(code);
            CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner);
        `);
        console.log('✅ 分享表已创建');

        console.log('\n✅ PostgreSQL数据库初始化完成！\n');
    } finally {
        client.release();
        await pool.end();
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('\n🗄️  文件分享系统 - 数据库初始化工具\n');

    const dbType = config.database.type.toLowerCase();

    try {
        switch (dbType) {
            case 'mysql':
                await initMySQL();
                break;
            case 'postgresql':
                await initPostgreSQL();
                break;
            case 'json':
                console.log('✅ JSON数据库无需初始化\n');
                break;
            case 'mongodb':
                console.log('✅ MongoDB无需初始化\n');
                break;
            default:
                throw new Error(`不支持的数据库类型: ${dbType}`);
        }

        console.log('🎉 初始化完成！\n');
    } catch (error) {
        console.error('❌ 初始化失败:', error.message);
        process.exit(1);
    }
}

main();
