const { processCasesForWebpage } = require('./generate-case-webpages');

// 监控网页生成进度
async function monitorWebpageGeneration() {
    console.log('🔍 监控网页生成进度...');
    
    try {
        await processCasesForWebpage();
    } catch (error) {
        console.error('监控错误:', error);
    }
}

// 每10分钟检查一次
setInterval(monitorWebpageGeneration, 10 * 60 * 1000);

// 立即开始监控
monitorWebpageGeneration();