const { chromium } = require('playwright');

async function debugSpanishPrecise() {
    console.log('🔍 精确调试西班牙语版本Buscar按钮...');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 300
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    
    try {
        console.log('🌐 正在加载西班牙语页面...');
        
        // 只加载一次页面
        await page.goto('https://www.missingkids.org/es/gethelpnow/search/poster-search-results', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('✅ 页面加载完成');
        
        // 等待页面稳定
        await page.waitForTimeout(3000);
        
        // 截图初始状态
        await page.screenshot({ path: 'debug-spanish-precise-before.png', fullPage: true });
        console.log('📸 初始页面截图已保存');
        
        // 查找所有按钮并显示信息
        console.log('\n🔎 查找页面上的所有按钮:');
        const buttons = await page.$$('button, input[type="button"], input[type="submit"]');
        
        for (let i = 0; i < buttons.length; i++) {
            try {
                const button = buttons[i];
                const tagName = await button.evaluate(el => el.tagName);
                const type = await button.getAttribute('type') || 'N/A';
                const value = await button.getAttribute('value') || 'N/A';
                const text = await button.evaluate(el => el.textContent?.trim() || 'N/A');
                const isVisible = await button.isVisible();
                const isEnabled = await button.isEnabled();
                
                console.log(`  ${i+1}. ${tagName}[type="${type}"] - 文本: "${text}", 可见: ${isVisible}, 可点击: ${isEnabled}`);
            } catch (error) {
                console.log(`  按钮 ${i+1} 信息获取失败`);
            }
        }
        
        // 精确查找Buscar按钮
        console.log('\n🔍 精确查找Buscar按钮...');
        
        // 方法1: 通过文本内容查找
        const buscarButton = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
            return buttons.find(btn => {
                const text = btn.textContent?.trim() || btn.value?.trim() || '';
                return text.toLowerCase().includes('buscar');
            });
        });
        
        if (buscarButton.asElement()) {
            console.log('✅ 通过文本找到Buscar按钮');
            
            const buttonElement = buscarButton.asElement();
            const text = await buttonElement.evaluate(el => el.textContent?.trim() || el.value?.trim() || '');
            console.log(`  按钮文本: "${text}"`);
            
            const isVisible = await buttonElement.isVisible();
            const isEnabled = await buttonElement.isEnabled();
            console.log(`  可见性: ${isVisible}, 可点击: ${isEnabled}`);
            
            if (isVisible && isEnabled) {
                // 确保按钮在视图中
                await buttonElement.scrollIntoViewIfNeeded();
                await page.waitForTimeout(1000);
                
                console.log('🖱️ 点击Buscar按钮...');
                await buttonElement.click({ delay: 100 });
                console.log('✅ Buscar按钮点击成功');
                
                // 等待页面响应（不刷新页面）
                console.log('⏳ 等待搜索结果加载...');
                await page.waitForTimeout(8000);
                
                // 检查是否显示结果
                const hasResults = await page.evaluate(() => {
                    return document.body.textContent.includes('NCMC') || 
                           document.body.textContent.includes('AMBER') ||
                           document.querySelector('.search-results, .results, tbody, table') !== null;
                });
                
                console.log(hasResults ? '✅ 搜索结果已加载' : '❌ 未检测到搜索结果');
            }
        } else {
            console.log('❌ 未找到Buscar按钮，尝试其他方法...');
            
            // 方法2: 查找表单中的提交按钮
            const forms = await page.$$('form');
            for (const form of forms) {
                const submitButton = await form.$('button[type="submit"], input[type="submit"]');
                if (submitButton) {
                    console.log('✅ 找到表单提交按钮');
                    await submitButton.click({ delay: 100 });
                    console.log('✅ 表单提交按钮点击成功');
                    await page.waitForTimeout(5000);
                    break;
                }
            }
        }
        
        // 截图最终状态
        await page.screenshot({ path: 'debug-spanish-precise-after.png', fullPage: true });
        console.log('📸 最终页面截图已保存');
        
        // 显示页面状态
        const currentUrl = page.url();
        console.log(`🔗 当前URL: ${currentUrl}`);
        
        const pageText = await page.evaluate(() => document.body.textContent);
        console.log(`📏 页面文本长度: ${pageText.length} 字符`);
        
        // 检查案件数据
        const caseCount = await page.evaluate(() => {
            const text = document.body.textContent;
            const ncmcMatches = text.match(/NCMC\d+/g) || [];
            const amberMatches = text.match(/AMBER\d+/g) || [];
            return ncmcMatches.length + amberMatches.length;
        });
        
        console.log(caseCount > 0 ? `✅ 检测到 ${caseCount} 个案件` : '❌ 未检测到案件数据');
        
    } catch (error) {
        console.error('❌ 调试失败:', error.message);
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

debugSpanishPrecise().catch(console.error);