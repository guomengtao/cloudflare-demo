const { chromium } = require('playwright');

async function debugSpanishButtonEnhanced() {
    console.log('🔍 调试西班牙语版本Submit按钮（增强版）...');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500 // 中等速度以便观察
    });
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    try {
        // 增加页面加载超时时间
        console.log('🌐 正在加载西班牙语页面...');
        await page.goto('https://www.missingkids.org/es/gethelpnow/search/poster-search-results', {
            waitUntil: 'domcontentloaded', // 先等待DOM加载完成
            timeout: 90000 // 90秒超时
        });
        
        console.log('✅ DOM加载完成，等待页面完全加载...');
        
        // 等待页面完全加载
        await page.waitForLoadState('networkidle', { timeout: 60000 });
        console.log('✅ 页面完全加载完成');
        
        // 截图初始状态
        await page.screenshot({ path: 'debug-spanish-before-enhanced.png', fullPage: true });
        console.log('📸 初始页面截图已保存');
        
        // 等待额外时间确保所有元素都加载完成
        console.log('⏳ 等待页面元素完全渲染...');
        await page.waitForTimeout(5000);
        
        // 查找西班牙语版本的按钮和表单
        console.log('\n🔎 查找西班牙语页面上的表单元素:');
        
        // 查找所有按钮
        const buttons = await page.$$('button, input[type="button"], input[type="submit"]');
        console.log(`  找到 ${buttons.length} 个按钮元素`);
        
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            const tagName = await button.evaluate(el => el.tagName);
            const type = await button.getAttribute('type') || 'N/A';
            const value = await button.getAttribute('value') || 'N/A';
            const text = await button.evaluate(el => el.textContent?.trim() || 'N/A');
            const isVisible = await button.isVisible();
            
            console.log(`  ${i+1}. ${tagName}[type="${type}"] - 值: "${value}", 文本: "${text}", 可见: ${isVisible}`);
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
        
        // 检查页面是否已经有结果
        console.log('\n🔍 检查页面是否已有结果...');
        const hasInitialResults = await page.evaluate(() => {
            const text = document.body.textContent;
            return text.includes('NCMC') || 
                   text.includes('AMBER') ||
                   text.includes('caso') ||
                   text.includes('desaparecido') ||
                   document.querySelector('.search-results, .results, tbody, table, .poster-card') !== null;
        });
        
        console.log(hasInitialResults ? '✅ 页面已显示结果' : '❌ 页面未显示结果');
        
        if (!hasInitialResults) {
            // 尝试点击西班牙语版本的Submit按钮
            console.log('\n🖱️  尝试点击西班牙语Submit按钮...');
            
            const spanishSelectors = [
                'input[type="submit"]',
                'button[type="submit"]',
                'input[value*="Enviar"]',
                'input[value*="Buscar"]',
                'button[value*="Enviar"]',
                'button[value*="Buscar"]',
                '.btn-primary',
                '.search-button',
                '#searchButton',
                '.submit'
            ];
            
            let clicked = false;
            for (const selector of spanishSelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        const isVisible = await button.isVisible();
                        const isEnabled = await button.isEnabled();
                        
                        console.log(`  找到西班牙语按钮: ${selector}`);
                        console.log(`  可见性: ${isVisible}, 可点击: ${isEnabled}`);
                        
                        if (!isVisible) {
                            console.log('  按钮不可见，尝试滚动到视图...');
                            await button.scrollIntoViewIfNeeded();
                            await page.waitForTimeout(2000);
                            
                            // 重新检查可见性
                            const nowVisible = await button.isVisible();
                            console.log(`  滚动后可见性: ${nowVisible}`);
                        }
                        
                        if (isEnabled) {
                            await button.click({ delay: 100 });
                            console.log('  ✅ 西班牙语按钮已点击');
                            clicked = true;
                            
                            // 等待更长时间让结果加载
                            console.log('⏳ 等待结果加载（15秒）...');
                            await page.waitForTimeout(15000);
                            
                            break;
                        } else {
                            console.log('  ⚠️ 按钮不可点击');
                        }
                    }
                } catch (error) {
                    console.log(`  按钮 ${selector} 处理失败:`, error.message);
                }
            }
            
            if (!clicked) {
                console.log('  ❌ 未找到标准西班牙语按钮，尝试文本匹配...');
                
                // 查找包含西班牙语关键词的按钮
                const allButtons = await page.$$('button, input');
                for (const button of allButtons) {
                    try {
                        const text = await button.evaluate(el => 
                            el.textContent?.trim() || el.value?.trim() || ''
                        );
                        
                        const spanishKeywords = ['enviar', 'buscar', 'enviar', 'búsqueda', 'submit', 'search'];
                        if (spanishKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
                            console.log(`  找到西班牙语文本按钮: "${text}"`);
                            
                            // 确保按钮可见
                            await button.scrollIntoViewIfNeeded();
                            await page.waitForTimeout(2000);
                            
                            const isEnabled = await button.isEnabled();
                            if (isEnabled) {
                                await button.click({ delay: 100 });
                                console.log('  ✅ 西班牙语文本按钮已点击');
                                clicked = true;
                                
                                // 等待结果加载
                                console.log('⏳ 等待结果加载（15秒）...');
                                await page.waitForTimeout(15000);
                                break;
                            }
                        }
                    } catch (error) {
                        console.log('  文本按钮处理失败:', error.message);
                    }
                }
            }
            
            if (!clicked) {
                console.log('  ⚠️ 尝试自动等待页面自动加载结果...');
                await page.waitForTimeout(10000);
            }
        }
        
        // 检查最终结果状态
        console.log('\n🔍 检查最终结果状态...');
        const hasFinalResults = await page.evaluate(() => {
            const text = document.body.textContent;
            return text.includes('NCMC') || 
                   text.includes('AMBER') ||
                   text.includes('caso') ||
                   text.includes('desaparecido') ||
                   document.querySelector('.search-results, .results, tbody, table, .poster-card') !== null;
        });
        
        console.log(hasFinalResults ? '✅ 最终结果已加载' : '❌ 最终未检测到结果');
        
        // 截图最终状态
        await page.screenshot({ path: 'debug-spanish-after-enhanced.png', fullPage: true });
        console.log('📸 最终页面截图已保存');
        
        // 显示页面结构信息
        const html = await page.content();
        console.log(`\n📏 西班牙语页面HTML长度: ${html.length} 字符`);
        
        // 查找案件相关元素
        const caseElements = await page.$$('tr, .item, .card, .poster-card, .case-item');
        console.log(`🔍 找到 ${caseElements.length} 个可能的结果元素`);
        
        if (caseElements.length > 0) {
            console.log('\n📋 前3个结果元素的内容:');
            for (let i = 0; i < Math.min(3, caseElements.length); i++) {
                const text = await caseElements[i].evaluate(el => el.textContent?.trim().substring(0, 200) || '');
                console.log(`  ${i+1}. ${text}`);
            }
        }
        
        // 显示页面标题和URL
        const title = await page.title();
        const currentUrl = page.url();
        console.log(`\n🌐 页面标题: ${title}`);
        console.log(`🔗 当前URL: ${currentUrl}`);
        
    } catch (error) {
        console.error('❌ 西班牙语调试失败:', error.message);
    } finally {
        console.log('\n💡 按任意键关闭浏览器...');
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', async () => {
            await browser.close();
            console.log('🔚 西班牙语调试完成');
            process.exit();
        });
    }
}

debugSpanishButtonEnhanced().catch(console.error);