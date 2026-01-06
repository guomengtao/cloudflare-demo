const fs = require('fs');
const path = require('path');

// 目标目录（整个项目目录）
const targetDir = __dirname;
const maxFiles = 20000;

console.log(`🔍 开始统计整个项目目录的文件数量...`);
console.log(`📁 项目目录: ${targetDir}`);

// 递归统计所有文件
function countAllFiles(dir, excludeDirs = ['.git', 'node_modules']) {
    let totalFiles = 0;
    let fileTypes = {};
    
    function traverse(currentDir) {
        try {
            const items = fs.readdirSync(currentDir);
            
            for (const item of items) {
                // 跳过排除的目录
                if (excludeDirs.includes(item)) {
                    continue;
                }
                
                const itemPath = path.join(currentDir, item);
                const stats = fs.statSync(itemPath);
                
                if (stats.isDirectory()) {
                    traverse(itemPath);
                } else {
                    totalFiles++;
                    
                    // 统计文件类型
                    const ext = path.extname(item) || '无扩展名';
                    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
                }
            }
        } catch (error) {
            console.error(`❌ 读取目录 ${currentDir} 时出错: ${error.message}`);
        }
    }
    
    traverse(dir);
    return { totalFiles, fileTypes };
}

// 统计特定目录的文件
function countDirectoryFiles(dirPath, dirName) {
    let count = 0;
    try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = fs.statSync(itemPath);
            if (!stats.isDirectory()) {
                count++;
            }
        }
        console.log(`📁 ${dirName}: ${count} 个文件`);
        return count;
    } catch (error) {
        console.error(`❌ 统计 ${dirName} 时出错: ${error.message}`);
        return 0;
    }
}

// 主程序
try {
    console.log(`\n📊 开始统计各目录文件数量...`);
    
    // 统计主要目录
    const bigTestCount = countDirectoryFiles(path.join(targetDir, 'big-test'), 'big-test/');
    const rootCount = countDirectoryFiles(targetDir, '项目根目录');
    
    // 统计其他可能包含文件的目录
    let otherDirsCount = 0;
    const otherDirs = ['.wrangler', 'functions'];
    
    otherDirs.forEach(dir => {
        const dirPath = path.join(targetDir, dir);
        if (fs.existsSync(dirPath)) {
            const { totalFiles } = countAllFiles(dirPath);
            otherDirsCount += totalFiles;
            console.log(`📁 ${dir}/: ${totalFiles} 个文件`);
        }
    });
    
    // 计算总数
    const totalCount = bigTestCount + rootCount + otherDirsCount;
    
    console.log(`\n📊 统计汇总:`);
    console.log(`📁 big-test/: ${bigTestCount} 个文件`);
    console.log(`📁 项目根目录: ${rootCount} 个文件`);
    console.log(`📁 其他目录: ${otherDirsCount} 个文件`);
    console.log(`📄 文件总数: ${totalCount} 个文件`);
    console.log(`🎯 Cloudflare Pages限制: ${maxFiles} 个文件`);
    console.log(`✅ 状态: ${totalCount <= maxFiles ? '通过' : '超出限制'}`);
    
    if (totalCount > maxFiles) {
        console.log(`❌ 超出限制: ${totalCount - maxFiles} 个文件`);
    }
    
    // 详细文件类型统计
    console.log(`\n📋 详细文件类型统计:`);
    const { totalFiles: detailedTotal, fileTypes } = countAllFiles(targetDir);
    console.log(`📄 详细统计文件总数: ${detailedTotal} 个文件`);
    
    Object.keys(fileTypes).sort().forEach(ext => {
        console.log(`   ${ext}: ${fileTypes[ext]} 个文件`);
    });
    
    console.log(`\n💡 建议:`);
    if (totalCount <= maxFiles) {
        console.log(`✅ 整个项目文件数量符合Cloudflare Pages部署要求`);
    } else {
        const excess = totalCount - maxFiles;
        console.log(`❌ 需要删除 ${excess} 个文件`);
        console.log(`💡 建议删除策略:`);
        console.log(`   1. 优先删除 big-test/40/ 中的文件`);
        console.log(`   2. 删除不必要的临时文件 (.wrangler/tmp/)`);
        console.log(`   3. 清理项目根目录的临时文件`);
    }
    
} catch (error) {
    console.error(`❌ 统计失败: ${error.message}`);
}