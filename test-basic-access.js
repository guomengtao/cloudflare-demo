const { chromium } = require('playwright');

async function testBasicAccess() {
    console.log('🔍 测试基本页面访问...');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 300
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        console.log('🌐 尝试访问西班牙语页面...');
        
        // 监听网络请求
        page.on('request', request => {
            console.log('请求:', request.method(), request.url());
        });
        
        page.on('response', response => {
            if (response.status() !== 200) {
                console.log('响应:', response.status(), response.url());
            }
        });
        
        // 简单的页面访问
        await page.goto('https://www.missingkids.org/es/gethelpnow/search/poster-search-results', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('✅ 页面访问成功');
        
        // 获取基本信息
        const title = await page.title();
        const url = page.url();
        const content = await page.content();
        
        console.log(`📄 标题: ${title}`);
        console.log(`🔗 URL: ${url}`);
        console.log(`📏 内容长度: ${content.length} 字符`);
        
        // 检查页面是否包含预期内容
        const hasExpectedContent = content.includes('Missing Kids') || 
                                  content.includes('Desaparecidos') ||
                                  content.includes('Search') ||
                                  content.includes('Buscar');
        
        console.log(hasExpectedContent ? '✅ 页面包含预期内容' : '❌ 页面可能未正确加载');
        
        // 截图
        await page.screenshot({ path: 'test-basic-access.png' });
        console.log('📸 截图已保存');
        
        // 显示页面结构摘要
        const elementCounts = await page.evaluate(() => {
            return {
                forms: document.querySelectorAll('form').length,
                buttons: document.querySelectorAll('button').length,
                inputs: document.querySelectorAll('input').length,
                tables: document.querySelectorAll('table').length
            };
        });
        
        console.log('\n📊 页面元素统计:');
        console.log(`  表单: ${elementCounts.forms}`);
        console.log(`  按钮: ${elementCounts.buttons}`);
        console.log(`  输入框: ${elementCounts.inputs}`);
        console.log(`  表格: ${elementCounts.tables}`);
        
        console.log('\n🎉 基本访问测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        console.log('\n💡 按任意键关闭浏览器...');
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', async () => {
            await browser.close();
            process.exit();
        });
    }
}

testBasicAccess().catch(console.error);