const { chromium } = require('playwright');

async function debugSpanishButtonStable() {
    console.log('🔍 调试西班牙语版本Submit按钮（稳定版）...');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    page.setDefaultTimeout(120000); // 设置默认超时120秒
    
    try {
        // 监听页面事件
        page.on('console', msg => console.log('页面日志:', msg.text()));
        page.on('pageerror', error => console.log('页面错误:', error));
        
        console.log('🌐 正在加载西班牙语页面...');
        
        // 使用更简单的加载策略
        const response = await page.goto('https://www.missingkids.org/es/gethelpnow/search/poster-search-results', {
            waitUntil: 'domcontentloaded',
            timeout: 120000
        });
        
        if (!response || !response.ok()) {
            console.log('⚠️ 页面加载可能有问题，状态码:', response?.status());
        }
        
        console.log('✅ 页面基础加载完成');
        
        // 使用更稳定的等待方式
        console.log('⏳ 等待页面内容渲染...');
        await page.waitForFunction(() => {
            return document.readyState === 'complete' && 
                   document.body && 
                   document.body.textContent.length > 100;
        }, { timeout: 60000 });
        
        console.log('✅ 页面内容渲染完成');
        
        // 截图初始状态
        await page.screenshot({ path: 'debug-spanish-stable-before.png' });
        console.log('📸 初始页面截图已保存');
        
        // 检查页面基本状态
        const title = await page.title();
        const url = page.url();
        console.log(`📄 页面标题: ${title}`);
        console.log(`🔗 当前URL: ${url}`);
        
        // 检查页面内容
        const pageText = await page.evaluate(() => document.body.textContent);
        console.log(`📏 页面文本长度: ${pageText.length} 字符`);
        
        // 查找表单元素
        console.log('\n🔎 查找页面上的表单元素:');
        
        // 查找所有按钮
        const buttons = await page.$$('button, input[type="button"], input[type="submit"]');
        console.log(`  找到 ${buttons.length} 个按钮元素`);
        
        for (let i = 0; i < buttons.length; i++) {
            try {
                const button = buttons[i];
                const tagName = await button.evaluate(el => el.tagName);
                const type = await button.getAttribute('type') || 'N/A';
                const value = await button.getAttribute('value') || 'N/A';
                const text = await button.evaluate(el => el.textContent?.trim() || 'N/A');
                const isVisible = await button.isVisible().catch(() => false);
                
                console.log(`  ${i+1}. ${tagName}[type="${type}"] - 值: "${value}", 文本: "${text}", 可见: ${isVisible}`);
            } catch (error) {
                console.log(`  按钮 ${i+1} 信息获取失败:`, error.message);
            }
        }
        
        // 查找表单
        const forms = await page.$$('form');
        console.log(`\n  找到 ${forms.length} 个表单元素`);
        
        for (let i = 0; i < forms.length; i++) {
            try {
                const form = forms[i];
                const formId = await form.getAttribute('id') || '无ID';
                const formAction = await form.getAttribute('action') || '无action';
                console.log(`  Form ${i+1}: ID="${formId}", Action="${formAction}"`);
            } catch (error) {
                console.log(`  表单 ${i+1} 信息获取失败:`, error.message);
            }
        }
        
        // 检查是否有搜索结果
        console.log('\n🔍 检查页面内容...');
        const hasSearchTerms = await page.evaluate(() => {
            const text = document.body.textContent.toLowerCase();
            return text.includes('search') || 
                   text.includes('buscar') ||
                   text.includes('submit') ||
                   text.includes('enviar') ||
                   text.includes('missing') ||
                   text.includes('desaparecido');
        });
        
        console.log(hasSearchTerms ? '✅ 页面包含搜索相关术语' : '❌ 页面可能未正确加载');
        
        // 尝试简单的交互
        console.log('\n🖱️ 尝试简单交互...');
        
        // 先尝试查找并点击最明显的按钮
        const commonSelectors = [
            'input[type="submit"]',
            'button[type="submit"]',
            'button:contains("Submit")',
            'button:contains("Search")',
            'button:contains("Buscar")',
            'button:contains("Enviar")',
            '.btn-primary',
            '.search-button'
        ];
        
        let interactionSuccess = false;
        
        for (const selector of commonSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`  找到元素: ${selector}`);
                    
                    // 检查元素状态
                    const isVisible = await element.isVisible().catch(() => false);
                    const isEnabled = await element.isEnabled().catch(() => false);
                    
                    console.log(`  可见性: ${isVisible}, 可点击: ${isEnabled}`);
                    
                    if (isVisible && isEnabled) {
                        // 确保元素在视图中
                        await element.scrollIntoViewIfNeeded();
                        await page.waitForTimeout(1000);
                        
                        // 点击元素
                        await element.click({ delay: 100 });
                        console.log('  ✅ 元素点击成功');
                        
                        // 等待响应
                        console.log('⏳ 等待页面响应...');
                        await page.waitForTimeout(5000);
                        
                        interactionSuccess = true;
                        break;
                    }
                }
            } catch (error) {
                console.log(`  选择器 ${selector} 交互失败:`, error.message);
            }
        }
        
        if (!interactionSuccess) {
            console.log('  ⚠️ 未找到可点击的标准按钮，尝试文本匹配...');
            
            // 查找包含特定文本的按钮
            const allClickable = await page.$$('button, input[type="button"], input[type="submit"], a.btn');
            for (const element of allClickable) {
                try {
                    const text = await element.evaluate(el => 
                        el.textContent?.trim() || el.value?.trim() || el.getAttribute('aria-label') || ''
                    );
                    
                    const searchKeywords = ['submit', 'search', 'buscar', 'enviar', 'go', 'find'];
                    if (searchKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
                        console.log(`  找到文本匹配元素: "${text}"`);
                        
                        const isVisible = await element.isVisible().catch(() => false);
                        const isEnabled = await element.isEnabled().catch(() => false);
                        
                        if (isVisible && isEnabled) {
                            await element.scrollIntoViewIfNeeded();
                            await page.waitForTimeout(1000);
                            
                            await element.click({ delay: 100 });
                            console.log('  ✅ 文本匹配元素点击成功');
                            
                            await page.waitForTimeout(5000);
                            interactionSuccess = true;
                            break;
                        }
                    }
                } catch (error) {
                    // 忽略单个元素错误，继续尝试下一个
                }
            }
        }
        
        // 截图最终状态
        await page.screenshot({ path: 'debug-spanish-stable-after.png' });
        console.log('📸 交互后页面截图已保存');
        
        // 检查最终页面状态
        const finalText = await page.evaluate(() => document.body.textContent);
        console.log(`📏 最终页面文本长度: ${finalText.length} 字符`);
        
        // 检查是否有案件数据
        const hasCaseData = await page.evaluate(() => {
            const text = document.body.textContent;
            return text.includes('NCMC') || text.includes('AMBER');
        });
        
        console.log(hasCaseData ? '✅ 检测到案件数据' : '❌ 未检测到案件数据');
        
        if (interactionSuccess) {
            console.log('\n🎉 交互测试完成！');
        } else {
            console.log('\n⚠️ 交互测试未完成，可能需要手动检查页面结构');
        }
        
    } catch (error) {
        console.error('❌ 调试失败:', error.message);
        console.error('错误堆栈:', error.stack);
    } finally {
        console.log('\n💡 按任意键关闭浏览器...');
        
        // 更安全的关闭方式
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', async () => {
            try {
                await context.close();
                await browser.close();
                console.log('🔚 浏览器已安全关闭');
            } catch (closeError) {
                console.log('关闭浏览器时出错:', closeError.message);
            }
            process.exit();
        });
        
        // 设置超时自动关闭（10分钟后）
        setTimeout(async () => {
            console.log('\n⏰ 10分钟超时，自动关闭浏览器...');
            try {
                await context.close();
                await browser.close();
                process.exit();
            } catch (error) {
                process.exit();
            }
        }, 10 * 60 * 1000);
    }
}

debugSpanishButtonStable().catch(console.error);