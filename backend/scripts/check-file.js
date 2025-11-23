const fs = require('fs-extra');
const path = require('path');
const { FILES_ROOT } = require('../src/utils/fileHelpers');

// 检查文件是否存在
const filePath = path.join(FILES_ROOT, 'admin/1763382345378/1763478261456/0655ba65_2025-11-19T17-52-54-193Z');
const exists = fs.existsSync(filePath);

console.log(`文件路径: ${filePath}`);
console.log(`文件存在: ${exists}`);