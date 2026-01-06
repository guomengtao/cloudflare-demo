const fs = require('fs');
const path = require('path');

// 目标目录
const targetDir = path.join(__dirname, 'big-test');

// 要处理的文件夹范围（31-40）
const startFolder = 31;
const endFolder = 40;
const filesPerFolder = 500;

console.log(`📁 为文件夹 ${startFolder} 到 ${endFolder} 生成HTML文件...`);

// 生成文件夹列表
const folders = [];
for (let i = startFolder; i <= endFolder; i++) {
    const folderName = i.toString().padStart(2, '0');
    folders.push(folderName);
}

let totalFilesCreated = 0;

folders.forEach(folderName => {
    const folderPath = path.join(targetDir, folderName);
    
    // 确保文件夹存在
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        console.log(`✅ 创建文件夹: ${folderName}`);
    }
    
    let filesCreatedInFolder = 0;
    
    // 生成500个HTML文件
    for (let fileNum = 1; fileNum <= filesPerFolder; fileNum++) {
        const fileName = fileNum.toString().padStart(3, '0') + '.html';
        const filePath = path.join(folderPath, fileName);
        
        // 如果文件已存在，跳过
        if (fs.existsSync(filePath)) {
            continue;
        }
        
        // HTML文件内容
        const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件 ${fileName} - 目录 ${folderName}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }
        .file-info {
            background: #e8f5e8;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .home-button {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 20px;
            transition: background 0.3s;
        }
        .home-button:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📄 欢迎访问 ${fileName}</h1>
        
        <div class="file-info">
            <h2>📋 文件信息</h2>
            <p><strong>文件名:</strong> ${fileName}</p>
            <p><strong>所在目录:</strong> ${folderName} 目录</p>
            <p><strong>文件编号:</strong> ${fileNum}</p>
        </div>
        
        <p>欢迎访问 <strong>${fileName}</strong> 文件！当前的目录是 <strong>${folderName}</strong> 目录。</p>
        <p>这是自动生成的HTML文件，用于测试和演示目的。</p>
        
        <a href="/" class="home-button">🏠 返回首页</a>
    </div>
</body>
</html>`;
        
        // 写入文件
        fs.writeFileSync(filePath, htmlContent);
        filesCreatedInFolder++;
        totalFilesCreated++;
    }
    
    console.log(`✅ 文件夹 ${folderName}: 创建了 ${filesCreatedInFolder} 个HTML文件`);
});

console.log(`\n🎉 完成!`);
console.log(`📊 统计信息:`);
console.log(`   - 处理的文件夹: ${folders.length} 个 (${startFolder}-${endFolder})`);
console.log(`   - 创建的HTML文件: ${totalFilesCreated} 个`);
console.log(`   - 每个文件夹目标文件数: ${filesPerFolder} 个`);
console.log(`📍 文件位置: ${targetDir}`);