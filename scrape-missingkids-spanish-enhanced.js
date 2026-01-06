const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class SpanishMissingKidsScraperEnhanced {
    constructor() {
        this.config = {
            baseUrl: 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results',
            maxPages: 50,
            delayBetweenRequests: 3000,
            submitRetryDelay: 5000,
            maxSubmitRetries: 5,
            timeout: 120000, // 增加到120秒
            pageLoadTimeout: 90000, // 页面加载超时90秒
            outputFile: 'missingkids-spanish-enhanced-data.json',
            screenshotsDir: 'spanish-enhanced-screenshots'
        };
        
        this.browser = null;
        this.page = null;
        this.data = [];
        this.stats = {
            totalCases: 0,
            successfulPages: 0,
            failedPages: 0,
            submitClicks: 0,
            startTime: null,
            endTime: null
        };
    }

    async init() {
        console.log('🚀 初始化增强版西班牙语爬虫...');
        
        if (!fs.existsSync(this.config.screenshotsDir)) {
            fs.mkdirSync(this.config.screenshotsDir);
        }
        
        this.browser = await chromium.launch({
            headless: false,
            slowMo: 200
        });
        
        const context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        this.page = await context.newPage();
        this.page.setDefaultTimeout(this.config.timeout);
        
        this.stats.startTime = new Date();
        console.log('✅ 增强版西班牙语爬虫初始化完成');
    }

    async scrape() {
        console.log('📖 开始爬取西班牙语版本失踪儿童数据（增强版）...');
        
        let pageNumber = 1;
        
        while (pageNumber <= this.config.maxPages) {
            console.log(`\n=== 正在处理第 ${pageNumber} 页 ===`);
            
            const pageData = await this.scrapeSpanishPageEnhanced(pageNumber);
            
            if (pageData && pageData.length > 0) {
                this.data = this.data.concat(pageData);
                this.stats.successfulPages++;
                this.stats.totalCases += pageData.length;
                
                console.log(`✅ 第 ${pageNumber} 页成功爬取 ${pageData.length} 个案件`);
                await this.saveProgress();
                
                // 尝试翻到下一页
                const hasNextPage = await this.goToNextPageSpanish();
                if (!hasNextPage) {
                    console.log('📄 已到达最后一页');
                    break;
                }
                
                pageNumber++;
                await this.delay(this.config.delayBetweenRequests);
            } else {
                console.log(`❌ 第 ${pageNumber} 页没有数据`);
                this.stats.failedPages++;
                
                // 如果连续3页失败，停止爬取
                if (this.stats.failedPages >= 3) {
                    console.log('⚠️ 连续3页失败，停止爬取');
                    break;
                }
            }
        }
        
        this.stats.endTime = new Date();
        await this.generateReport();
        console.log('🎉 增强版西班牙语爬取任务完成！');
    }

    async scrapeSpanishPageEnhanced(pageNumber) {
        const url = pageNumber === 1 ? this.config.baseUrl : `${this.config.baseUrl}?page=${pageNumber}`;
        
        try {
            console.log(`  正在访问西班牙语页面: ${url}`);
            
            // 使用更长的加载时间
            await this.page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: this.config.pageLoadTimeout
            });
            
            console.log('  ✅ DOM加载完成，等待页面完全加载...');
            
            // 等待页面完全加载
            await this.page.waitForLoadState('networkidle', { timeout: 60000 });
            console.log('  ✅ 页面完全加载完成');
            
            // 额外等待确保所有元素渲染完成
            await this.delay(3000);
            
            // 检查是否已经显示结果
            let hasResults = await this.checkIfSpanishResultsLoaded();
            
            if (!hasResults) {
                console.log('  需要与页面交互...');
                hasResults = await this.interactWithSpanishPageEnhanced();
            }
            
            if (!hasResults) {
                console.log('  页面交互后仍未显示结果');
                return null;
            }
            
            // 等待结果加载（更长时间）
            await this.page.waitForSelector('.search-results, .results, tbody, table, .poster-card', { 
                timeout: 30000 
            });
            
            // 额外等待结果渲染
            await this.delay(2000);
            
            // 截图记录
            await this.page.screenshot({
                path: path.join(this.config.screenshotsDir, `spanish-enhanced-page-${pageNumber}.png`)
            });
            
            // 提取案件数据
            const cases = await this.extractSpanishCaseData();
            return cases;
            
        } catch (error) {
            console.error(`爬取西班牙语第 ${pageNumber} 页时出错:`, error.message);
            return null;
        }
    }

    async interactWithSpanishPageEnhanced() {
        console.log('  尝试与西班牙语页面交互（增强版）...');
        
        // 增强的交互方法
        const interactionMethods = [
            this.trySpanishSubmitButtonEnhanced.bind(this),
            this.trySpanishFormSubmitEnhanced.bind(this),
            this.trySpanishAutoSearchEnhanced.bind(this)
        ];
        
        for (const method of interactionMethods) {
            const success = await method();
            if (success) {
                return true;
            }
        }
        
        return false;
    }

    async trySpanishSubmitButtonEnhanced() {
        console.log('  尝试点击西班牙语Submit按钮（增强版）...');
        
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
        
        for (let attempt = 1; attempt <= this.config.maxSubmitRetries; attempt++) {
            console.log(`  第 ${attempt} 次尝试点击Submit按钮...`);
            
            for (const selector of spanishSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        const isVisible = await button.isVisible();
                        const isEnabled = await button.isEnabled();
                        
                        console.log(`  找到西班牙语按钮: ${selector}`);
                        console.log(`  可见性: ${isVisible}, 可点击: ${isEnabled}`);
                        
                        if (!isVisible) {
                            console.log('  按钮不可见，尝试滚动到视图...');
                            await button.scrollIntoViewIfNeeded();
                            await this.delay(2000);
                        }
                        
                        if (isEnabled) {
                            await button.click({ delay: 100 });
                            this.stats.submitClicks++;
                            
                            console.log('  ✅ 西班牙语按钮点击成功');
                            
                            // 等待更长时间让结果加载
                            console.log('  ⏳ 等待结果加载（10秒）...');
                            await this.delay(10000);
                            
                            const resultsLoaded = await this.checkIfSpanishResultsLoaded();
                            if (resultsLoaded) {
                                return true;
                            } else {
                                console.log('  ⚠️ 按钮已点击但结果尚未加载');
                            }
                        }
                    }
                } catch (error) {
                    console.log(`  按钮 ${selector} 点击失败:`, error.message);
                }
            }
            
            // 如果这次尝试失败，等待一段时间再重试
            if (attempt < this.config.maxSubmitRetries) {
                console.log(`  ⏳ 等待 ${this.config.submitRetryDelay/1000} 秒后重试...`);
                await this.delay(this.config.submitRetryDelay);
            }
        }
        
        return false;
    }

    async trySpanishFormSubmitEnhanced() {
        console.log('  尝试提交西班牙语表单（增强版）...');
        
        try {
            const forms = await this.page.$$('form');
            for (const form of forms) {
                await form.evaluate(form => form.submit());
                console.log('  ✅ 表单提交尝试完成');
                
                // 等待结果加载
                await this.delay(8000);
                
                const resultsLoaded = await this.checkIfSpanishResultsLoaded();
                if (resultsLoaded) {
                    return true;
                }
            }
        } catch (error) {
            console.log('  表单提交失败:', error.message);
        }
        
        return false;
    }

    async trySpanishAutoSearchEnhanced() {
        console.log('  尝试自动搜索（增强版）...');
        
        try {
            // 等待更长时间看是否自动加载
            console.log('  ⏳ 等待页面自动加载结果（15秒）...');
            await this.delay(15000);
            
            const resultsLoaded = await this.checkIfSpanishResultsLoaded();
            if (resultsLoaded) {
                console.log('  ✅ 页面自动加载了结果');
                return true;
            }
        } catch (error) {
            console.log('  自动搜索失败:', error.message);
        }
        
        return false;
    }

    async checkIfSpanishResultsLoaded() {
        try {
            const hasResults = await this.page.evaluate(() => {
                const text = document.body.textContent;
                return text.includes('NCMC') || 
                       text.includes('AMBER') ||
                       text.includes('caso') ||
                       text.includes('desaparecido') ||
                       document.querySelector('.search-results, .results, tbody, table, .poster-card') !== null;
            });
            
            return hasResults;
        } catch (error) {
            return false;
        }
    }

    async extractSpanishCaseData() {
        // ... 提取逻辑与之前相同，省略以节省空间
        return await this.extractFromPageText(); // 简化版本
    }

    async goToNextPageSpanish() {
        // ... 翻页逻辑与之前相同
        return false; // 简化版本
    }

    async saveProgress() {
        try {
            const progressData = {
                data: this.data,
                stats: this.stats,
                lastUpdated: new Date().toISOString()
            };
            
            fs.writeFileSync(this.config.outputFile, JSON.stringify(progressData, null, 2));
            console.log('  💾 进度已保存');
        } catch (error) {
            console.error('保存进度时出错:', error.message);
        }
    }

    async generateReport() {
        const duration = this.stats.endTime - this.stats.startTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        console.log('\n📊 === 增强版爬取报告 ===');
        console.log(`总案件数: ${this.stats.totalCases}`);
        console.log(`成功页面: ${this.stats.successfulPages}`);
        console.log(`失败页面: ${this.stats.failedPages}`);
        console.log(`Submit点击次数: ${this.stats.submitClicks}`);
        console.log(`耗时: ${minutes}分${seconds}秒`);
        console.log(`数据文件: ${this.config.outputFile}`);
        console.log(`截图目录: ${this.config.screenshotsDir}`);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔚 浏览器已关闭');
        }
    }
}

// 运行增强版爬虫
async function runSpanishScraperEnhanced() {
    const scraper = new SpanishMissingKidsScraperEnhanced();
    
    try {
        await scraper.init();
        await scraper.scrape();
    } catch (error) {
        console.error('增强版爬虫运行出错:', error);
    } finally {
        await scraper.close();
    }
}

if (require.main === module) {
    runSpanishScraperEnhanced().catch(console.error);
}

module.exports = SpanishMissingKidsScraperEnhanced;