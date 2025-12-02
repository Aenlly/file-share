const Jimp = require('jimp');
const path = require('path');
const fs = require('fs-extra');

async function testExifRotate() {
    try {
        console.log('Jimp 版本:', Jimp.version);
        console.log('Jimp 可用方法:', Object.getOwnPropertyNames(Jimp.prototype).filter(m => m.includes('exif') || m.includes('rotate')));
        
        // 查找一个测试图片
        const filesRoot = path.join(__dirname, 'files');
        
        if (!await fs.pathExists(filesRoot)) {
            console.log('files 目录不存在');
            return;
        }
        
        // 递归查找第一个 jpg 文件
        async function findFirstImage(dir) {
            const items = await fs.readdir(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = await fs.stat(fullPath);
                if (stat.isDirectory()) {
                    const found = await findFirstImage(fullPath);
                    if (found) return found;
                } else if (item.toLowerCase().endsWith('.jpg') || item.toLowerCase().endsWith('.jpeg')) {
                    return fullPath;
                }
            }
            return null;
        }
        
        const testImagePath = await findFirstImage(filesRoot);
        if (!testImagePath) {
            console.log('未找到测试图片');
            return;
        }
        
        console.log('\n测试图片:', testImagePath);
        
        const image = await Jimp.read(testImagePath);
        console.log('图片尺寸:', image.bitmap.width, 'x', image.bitmap.height);
        console.log('EXIF 数据:', image._exif);
        
        // 测试不同的旋转方法
        console.log('\n测试 exifRotate 方法:');
        if (typeof image.exifRotate === 'function') {
            console.log('✓ exifRotate 方法存在');
            image.exifRotate();
            console.log('✓ exifRotate 执行成功');
        } else {
            console.log('✗ exifRotate 方法不存在');
            console.log('尝试其他方法...');
            
            // 检查是否有 EXIF orientation
            if (image._exif && image._exif.tags && image._exif.tags.Orientation) {
                const orientation = image._exif.tags.Orientation;
                console.log('EXIF Orientation:', orientation);
                
                // 手动处理旋转
                switch (orientation) {
                    case 3:
                        image.rotate(180);
                        break;
                    case 6:
                        image.rotate(-90);
                        break;
                    case 8:
                        image.rotate(90);
                        break;
                }
                console.log('✓ 手动旋转完成');
            } else {
                console.log('图片没有 EXIF orientation 信息');
            }
        }
        
        console.log('\n测试完成');
        
    } catch (error) {
        console.error('测试失败:', error.message);
        console.error(error.stack);
    }
}

testExifRotate();
