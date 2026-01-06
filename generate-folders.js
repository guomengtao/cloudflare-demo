const fs = require('fs');
const path = require('path');

// 目标目录
const targetDir = path.join(__dirname, 'big-test');

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`创建目录: ${targetDir}`);
}

// 生成01到30的文件夹
const folders = [];
for (let i = 1; i <= 30; i++) {
    // 格式化数字为两位数（01, 02, ..., 30）
    const folderName = i.toString().padStart(2, '0');
    folders.push(folderName);
}

console.log(`将在 ${targetDir} 目录下创建以下文件夹:`);
console.log(folders.join(', '));

// 创建文件夹
let createdCount = 0;
folders.forEach(folderName => {
    const folderPath = path.join(targetDir, folderName);
    
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
        console.log(`✓ 创建文件夹: ${folderName}`);
        createdCount++;
    } else {
        console.log(`- 文件夹已存在: ${folderName}`);
    }
});

console.log(`\n完成! 共创建了 ${createdCount} 个新文件夹，${folders.length - createdCount} 个文件夹已存在。`);
console.log(`所有文件夹已生成在: ${targetDir}`);