const { chromium } = require('playwright');

async function debugSubmitButton() {
    console.log('🔍 调试Submit按钮...');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000 // 非常慢的速度以便观察
    });
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    try {
        // 访问页面
        await page.goto('https://www.missingkids.org/gethelpnow/search/poster-search-results', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        console.log('✅ 页面加载成功');
        
        // 截图初始状态
        await page.screenshot({ path: 'debug-before-submit.png', fullPage: true });
        console.log('📸 初始页面截图已保存');
        
        // 查找所有可能的按钮和输入框
        console.log('\n🔎 查找页面上的表单元素:');
        
        // 查找所有按钮
        const buttons = await page.$$('button, input[type="button"], input[type="submit"]');
        console.log(`  找到 ${buttons.length} 个按钮元素`);
        
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            const tagName = await button.evaluate(el => el.tagName);
            const type = await button.getAttribute('type') || 'N/A';
            const value = await button.getAttribute('value') || 'N/A';
            const text = await button.evaluate(el => el.textContent?.trim() || 'N/A');
            
            console.log(`  ${i+1}. ${tagName}[type="${type}"] - 值: "${value}", 文本: "${text}"`);
        }
        
        // 查找表单
        const forms = await page.$$('form');
        console.log(`\n  找到 ${forms.length} 个表单元素`);
        
        for (let i = 0; i < forms.length; i++) {
            const form = forms[i];
            const formId = await form.getAttribute('id') || '无ID';
            const formAction = await form.getAttribute('action') || '无action';
            console.log(`  Form ${i+1}: ID="${formId}", Action="${formAction}"`);
        }
        
        // 尝试点击最可能的Submit按钮
        console.log('\n🖱️  尝试点击Submit按钮...');
        
        const submitSelectors = [
            'input[type="submit"]',
            'button[type="submit"]',
            'input[value*="Submit"]',
            'input[value*="Search"]',
            'button[value*="Submit"]'
        ];
        
        let clicked = false;
        for (const selector of submitSelectors) {
            const button = await page.$(selector);
            if (button) {
                console.log(`  找到按钮: ${selector}`);
                await button.click();
                console.log('  ✅ 按钮已点击');
                clicked = true;
                break;
            }
        }
        
        if (!clicked) {
            console.log('  ❌ 未找到标准Submit按钮，尝试文本匹配...');
            
            // 查找包含"Submit"或"Search"文本的按钮
            const allButtons = await page.$$('button, input');
            for (const button of allButtons) {
                const text = await button.evaluate(el => 
                    el.textContent?.trim() || el.value?.trim() || ''
                );
                
                if (text.toLowerCase().includes('submit') || text.toLowerCase().includes('search')) {
                    console.log(`  找到文本按钮: "${text}"`);
                    await button.click();
                    console.log('  ✅ 按钮已点击');
                    clicked = true;
                    break;
                }
            }
        }
        
        if (clicked) {
            // 等待结果加载
            console.log('⏳ 等待结果加载...');
            await page.waitForTimeout(10000);
            
            // 截图点击后的状态
            await page.screenshot({ path: 'debug-after-submit.png', fullPage: true });
            console.log('📸 点击后页面截图已保存');
            
            // 检查是否有结果
            const hasResults = await page.evaluate(() => {
                return document.body.textContent.includes('NCMC') || 
                       document.body.textContent.includes('AMBER') ||
                       document.querySelector('table') !== null;
            });
            
            console.log(hasResults ? '✅ 结果已加载' : '❌ 未检测到结果');
            
            // 显示页面结构
            const html = await page.content();
            console.log(`\n📏 页面HTML长度: ${html.length} 字符`);
            
            // 查找案件相关元素
            const caseElements = await page.$$('tr, .item, .card');
            console.log(`🔍 找到 ${caseElements.length} 个可能的结果元素`);
            
            if (caseElements.length > 0) {
                console.log('\n📋 前3个结果元素的内容:');
                for (let i = 0; i < Math.min(3, caseElements.length); i++) {
                    const text = await caseElements[i].evaluate(el => el.textContent?.trim().substring(0, 200) || '');
                    console.log(`  ${i+1}. ${text}`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ 调试失败:', error.message);
    } finally {
        console.log('\n💡 按任意键关闭浏览器...');
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', async () => {
            await browser.close();
            console.log('🔚 调试完成');
            process.exit();
        });
    }
}

debugSubmitButton().catch(console.error);