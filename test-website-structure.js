const { chromium } = require('playwright');

async function testWebsiteStructure() {
    console.log('🔍 测试网站结构...');
    
    const browser = await chromium.launch({ headless: false }); // 非无头模式以便观察
    const page = await browser.newPage();
    
    try {
        await page.goto('https://www.missingkids.org/gethelpnow/search/poster-search-results?page=1', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('✅ 页面加载成功');
        
        // 获取页面标题
        const title = await page.title();
        console.log(`📄 页面标题: ${title}`);
        
        // 获取页面HTML结构
        const html = await page.content();
        console.log(`📏 页面长度: ${html.length} 字符`);
        
        // 检查关键元素
        const selectorsToCheck = [
            '.search-results',
            '.results-container',
            '.poster-card',
            '.search-result',
            'table',
            'tr',
            '.card',
            '.item'
        ];
        
        console.log('\n🔎 检查页面元素:');
        for (const selector of selectorsToCheck) {
            const count = await page.$$eval(selector, elements => elements.length);
            console.log(`  ${selector}: ${count} 个元素`);
        }
        
        // 检查链接模式
        const links = await page.$$eval('a[href*="/poster/"]', links => 
            links.map(link => link.href).slice(0, 5)
        );
        console.log('\n🔗 前5个详情页链接:');
        links.forEach(link => console.log(`  ${link}`));
        
        // 检查图片
        const images = await page.$$eval('img[src*="photographs"]', imgs => 
            imgs.map(img => img.src).slice(0, 3)
        );
        console.log('\n🖼️  前3个图片链接:');
        images.forEach(img => console.log(`  ${img}`));
        
        // 截图保存
        await page.screenshot({ path: 'website-structure.png', fullPage: true });
        console.log('\n📸 页面截图已保存为 website-structure.png');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        await browser.close();
        console.log('🔚 测试完成');
    }
}

testWebsiteStructure().catch(console.error);