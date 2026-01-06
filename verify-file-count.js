const fs = require('fs');
const path = require('path');

// 目标目录
const targetDir = path.join(__dirname, 'big-test');
const maxFiles = 20000;

console.log(`🔍 验证 ${targetDir} 目录的文件数量...`);

// 统计所有文件夹和文件
function countFiles(dir) {
    let htmlFiles = 0;
    let folders = 0;
    const folderStats = {};
    
    try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory() && /^\d{2}$/.test(item)) {
                folders++;
                const subItems = fs.readdirSync(itemPath);
                const filesInFolder = subItems.filter(subItem => subItem.endsWith('.html')).length;
                htmlFiles += filesInFolder;
                folderStats[item] = filesInFolder;
            }
        }
    } catch (error) {
        console.error(`❌ 读取目录时出错: ${error.message}`);
    }
    
    return { htmlFiles, folders, folderStats };
}

// 主程序
try {
    const { htmlFiles, folders, folderStats } = countFiles(targetDir);
    
    console.log(`\n📊 统计结果:`);
    console.log(`📁 文件夹数量: ${folders}`);
    console.log(`📄 HTML文件总数: ${htmlFiles}`);
    console.log(`🎯 Cloudflare Pages限制: ${maxFiles} 个文件`);
    console.log(`✅ 状态: ${htmlFiles <= maxFiles ? '通过' : '超出限制'}`);
    
    if (htmlFiles > maxFiles) {
        console.log(`❌ 超出限制: ${htmlFiles - maxFiles} 个文件`);
    }
    
    console.log(`\n📁 各文件夹文件数量:`);
    Object.keys(folderStats).sort().forEach(folder => {
        console.log(`   ${folder}: ${folderStats[folder]} 个文件`);
    });
    
    console.log(`\n💡 建议:`);
    if (htmlFiles <= maxFiles) {
        console.log(`✅ 文件数量符合Cloudflare Pages部署要求`);
    } else {
        console.log(`❌ 需要删除 ${htmlFiles - maxFiles} 个文件`);
        console.log(`💡 优先删除编号较大的文件夹中的文件`);
    }
    
} catch (error) {
    console.error(`❌ 验证失败: ${error.message}`);
}
