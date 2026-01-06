const fs = require('fs');
const path = require('path');

// 目标目录（整个项目目录）
const targetDir = __dirname;
const targetFiles = 19999; // 目标文件数
const maxFiles = 20000; // Cloudflare限制

console.log(`🔍 优化整个项目文件数量以适应Cloudflare Pages...`);
console.log(`📁 项目目录: ${targetDir}`);

// 统计当前文件总数
function countAllFiles(dir, excludeDirs = ['.git', 'node_modules']) {
    let totalFiles = 0;
    
    function traverse(currentDir) {
        try {
            const items = fs.readdirSync(currentDir);
            
            for (const item of items) {
                if (excludeDirs.includes(item)) {
                    continue;
                }
                
                const itemPath = path.join(currentDir, item);
                const stats = fs.statSync(itemPath);
                
                if (stats.isDirectory()) {
                    traverse(itemPath);
                } else {
                    totalFiles++;
                }
            }
        } catch (error) {
            console.error(`❌ 读取目录 ${currentDir} 时出错: ${error.message}`);
        }
    }
    
    traverse(dir);
    return totalFiles;
}

// 删除策略：按照优先级删除文件
function deleteFilesStrategy(dir, filesToDelete) {
    let deletedCount = 0;
    
    console.log(`🗑️ 需要删除 ${filesToDelete} 个文件`);
    
    // 删除策略优先级
    const deleteStrategies = [
        {
            name: 'big-test/40/ 中的文件',
            path: path.join(dir, 'big-test', '40'),
            pattern: /\.html$/,
            priority: 'high'
        },
        {
            name: 'big-test/39/ 中的文件',
            path: path.join(dir, 'big-test', '39'),
            pattern: /\.html$/,
            priority: 'high'
        },
        {
            name: '.wrangler/tmp/ 临时文件',
            path: path.join(dir, '.wrangler', 'tmp'),
            pattern: /.*/,
            priority: 'medium'
        },
        {
            name: '项目根目录的日志文件',
            path: dir,
            pattern: /\.log$/,
            priority: 'low'
        }
    ];
    
    // 执行删除策略
    for (const strategy of deleteStrategies) {
        if (deletedCount >= filesToDelete) break;
        
        if (fs.existsSync(strategy.path)) {
            console.log(`\n📁 处理: ${strategy.name}`);
            
            try {
                const items = fs.readdirSync(strategy.path);
                const filesToProcess = items
                    .filter(item => strategy.pattern.test(item))
                    .sort(); // 按名称排序
                
                for (const file of filesToProcess) {
                    if (deletedCount >= filesToDelete) break;
                    
                    const filePath = path.join(strategy.path, file);
                    const stats = fs.statSync(filePath);
                    
                    if (!stats.isDirectory()) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                        console.log(`   ✅ 删除: ${file}`);
                        
                        if (deletedCount % 10 === 0) {
                            console.log(`   📊 已删除 ${deletedCount}/${filesToDelete} 个文件`);
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ 处理 ${strategy.name} 时出错: ${error.message}`);
            }
        }
    }
    
    return deletedCount;
}

// 主程序
try {
    // 统计当前文件总数
    console.log(`\n🔍 统计当前文件总数...`);
    const currentTotal = countAllFiles(targetDir);
    console.log(`📄 当前总文件数: ${currentTotal}`);
    console.log(`🎯 目标文件数: ${targetFiles}`);
    
    if (currentTotal <= targetFiles) {
        console.log(`✅ 当前文件数已满足要求，无需删除`);
        process.exit(0);
    }
    
    const filesToDelete = currentTotal - targetFiles;
    
    // 删除文件
    console.log(`\n🗑️ 开始删除文件...`);
    const deletedCount = deleteFilesStrategy(targetDir, filesToDelete);
    
    // 最终统计
    console.log(`\n🔍 最终统计:`);
    const finalTotal = countAllFiles(targetDir);
    console.log(`📄 最终总文件数: ${finalTotal}`);
    console.log(`🗑️ 共删除文件: ${deletedCount} 个`);
    console.log(`🎯 目标达成: ${finalTotal <= targetFiles ? '✅' : '❌'}`);
    
    if (finalTotal > maxFiles) {
        console.log(`❌ 警告: 仍然超出Cloudflare限制 ${finalTotal - maxFiles} 个文件`);
    }
    
} catch (error) {
    console.error(`❌ 优化失败: ${error.message}`);
}