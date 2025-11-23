const fs = require('fs');
const path = require('path');

// 读取文件内容
const filePath = path.join(__dirname, 'data', 'files.json');
const content = fs.readFileSync(filePath, 'utf8');

// 修复编码
const fixedContent = content
    .replace(/ç®å/g, '简历')
    .replace(/��/g, '简历');

// 写回文件
fs.writeFileSync(filePath, fixedContent, 'utf8');

console.log('文件名修复完成');