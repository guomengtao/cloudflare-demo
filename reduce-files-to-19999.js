const fs = require('fs');
const path = require('path');

// 目标目录
const targetDir = path.join(__dirname, 'big-test');
const targetFiles = 19999;

console.log(`🔍 开始统计 ${targetDir} 目录的文件数量...`);

// 统计当前文件总数
function countTotalFiles(dir) {
    let total = 0;
    
    try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
                // 如果是数字文件夹（01-40）
                if (/^\d{2}$/.test(item)) {
                    const subItems = fs.readdirSync(itemPath);
                    const htmlFiles = subItems.filter(subItem => subItem.endsWith('.html'));
                    total += htmlFiles.length;
                    console.log(`📁 文件夹 ${item}: ${htmlFiles.length} 个HTML文件`);
                }
            }
        }
    } catch (error) {
        console.error(`❌ 读取目录时出错: ${error.message}`);
    }
    
    return total;
}

// 删除文件以达到目标数量
function deleteFilesToTarget(dir, currentTotal, targetTotal) {
    const filesToDelete = currentTotal - targetTotal;
    
    if (filesToDelete <= 0) {
        console.log(`✅ 当前文件数 (${currentTotal}) 已小于等于目标数 (${targetTotal})，无需删除`);
        return 0;
    }
    
    console.log(`🗑️ 需要删除 ${filesToDelete} 个文件以达到目标 ${targetTotal} 个文件`);
    
    let deletedCount = 0;
    
    // 按照优先级删除：40 -> 39 -> 38 -> ...
    const foldersToProcess = ['40', '39', '38', '37', '36', '35', '34', '33', '32', '31'];
    
    for (const folder of foldersToProcess) {
        if (deletedCount >= filesToDelete) break;
        
        const folderPath = path.join(dir, folder);
        
        if (fs.existsSync(folderPath)) {
            try {
                const files = fs.readdirSync(folderPath)
                    .filter(file => file.endsWith('.html'))
                    .sort((a, b) => {
                        // 按文件编号降序排序（从大到小删除）
                        const numA = parseInt(a.replace('.html', ''));
                        const numB = parseInt(b.replace('.html', ''));
                        return numB - numA;
                    });
                
                console.log(`📁 处理文件夹 ${folder}: ${files.length} 个文件`);
                
                for (const file of files) {
                    if (deletedCount >= filesToDelete) break;
                    
                    const filePath = path.join(folderPath, file);
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    
                    if (deletedCount % 100 === 0) {
                        console.log(`   ✅ 已删除 ${deletedCount}/${filesToDelete} 个文件`);
                    }
                }
                
                // 检查文件夹是否为空，如果为空则删除文件夹
                const remainingFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.html'));
                if (remainingFiles.length === 0) {
                    fs.rmdirSync(folderPath);
                    console.log(`📁 文件夹 ${folder} 已为空，删除文件夹`);
                } else {
                    console.log(`📁 文件夹 ${folder} 剩余 ${remainingFiles.length} 个文件`);
                }
                
            } catch (error) {
                console.error(`❌ 处理文件夹 ${folder} 时出错: ${error.message}`);
            }
        }
    }
    
    return deletedCount;
}

// 主程序
try {
    // 统计当前文件总数
    const currentTotal = countTotalFiles(targetDir);
    console.log(`\n📊 当前总文件数: ${currentTotal}`);
    console.log(`🎯 目标文件数: ${targetFiles}`);
    
    if (currentTotal <= targetFiles) {
        console.log(`✅ 当前文件数已满足要求，无需删除`);
        process.exit(0);
    }
    
    // 删除文件
    console.log(`\n🗑️ 开始删除文件...`);
    const deletedCount = deleteFilesToTarget(targetDir, currentTotal, targetFiles);
    
    // 最终统计
    console.log(`\n🔍 最终统计:`);
    const finalTotal = countTotalFiles(targetDir);
    console.log(`📊 最终总文件数: ${finalTotal}`);
    console.log(`🗑️ 共删除文件: ${deletedCount} 个`);
    console.log(`🎯 目标达成: ${finalTotal <= targetFiles ? '✅' : '❌'}`);
    
    if (finalTotal > targetFiles) {
        console.log(`⚠️ 警告: 仍然超出限制 ${finalTotal - targetFiles} 个文件`);
        console.log(`💡 建议: 可以继续删除更多文件`);
    }
    
} catch (error) {
    console.error(`❌ 程序执行出错: ${error.message}`);
}