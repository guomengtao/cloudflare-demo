const fs = require('fs');
const path = require('path');

// 目标目录
const targetDir = path.join(__dirname, 'big-test');

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`创建目录: ${targetDir}`);
}

// 生成31到40的文件夹
const newFolders = [];
for (let i = 31; i <= 40; i++) {
    // 格式化数字为两位数（31, 32, ..., 40）
    const folderName = i.toString().padStart(2, '0');
    newFolders.push(folderName);
}

console.log(`将在 ${targetDir} 目录下创建以下新文件夹:`);
console.log(newFolders.join(', '));

// 检查现有文件夹
const existingFolders = fs.readdirSync(targetDir)
    .filter(item => fs.statSync(path.join(targetDir, item)).isDirectory())
    .filter(folder => /^\d{2}$/.test(folder)); // 只匹配两位数字的文件夹

console.log(`\n现有文件夹 (01-${existingFolders.length}): ${existingFolders.sort().join(', ')}`);

// 创建新文件夹
let createdCount = 0;
newFolders.forEach(folderName => {
    const folderPath = path.join(targetDir, folderName);
    
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
        console.log(`✅ 创建文件夹: ${folderName}`);
        createdCount++;
    } else {
        console.log(`⚠️ 文件夹已存在: ${folderName}`);
    }
});

console.log(`\n🎉 完成!`);
console.log(`✅ 共创建了 ${createdCount} 个新文件夹`);
console.log(`📁 现在总共有 ${existingFolders.length + createdCount} 个文件夹 (01-${40})`);
console.log(`📍 所有文件夹位置: ${targetDir}`);