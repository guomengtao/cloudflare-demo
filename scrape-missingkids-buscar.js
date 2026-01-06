const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class BuscarMissingKidsScraper {
    constructor() {
        this.config = {
            baseUrl: 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results',
            maxPages: 10, // 先测试少量页面
            delayBetweenRequests: 3000,
            timeout: 60000,
            outputFile: 'missingkids-buscar-data.json',
            screenshotsDir: 'buscar-screenshots'
        };
        
        this.browser = null;
        this.page = null;
        this.data = [];
        this.stats = {
            totalCases: 0,
            successfulPages: 0,
            failedPages: 0,
            startTime: null,
            endTime: null
        };
    }

    async init() {
        console.log('🚀 初始化Buscar爬虫...');
        
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
        console.log('✅ Buscar爬虫初始化完成');
    }

    async scrape() {
        console.log('📖 开始爬取失踪儿童数据（Buscar版本）...');
        
        let pageNumber = 1;
        
        while (pageNumber <= this.config.maxPages) {
            console.log(`\n=== 正在处理第 ${pageNumber} 页 ===`);
            
            const pageData = await this.scrapePageWithBuscar(pageNumber);
            
            if (pageData && pageData.length > 0) {
                this.data = this.data.concat(pageData);
                this.stats.successfulPages++;
                this.stats.totalCases += pageData.length;
                
                console.log(`✅ 第 ${pageNumber} 页成功爬取 ${pageData.length} 个案件`);
                await this.saveProgress();
                
                // 尝试翻到下一页
                const hasNextPage = await this.goToNextPage();
                if (!hasNextPage) {
                    console.log('📄 已到达最后一页');
                    break;
                }
                
                pageNumber++;
                await this.delay(this.config.delayBetweenRequests);
            } else {
                console.log(`❌ 第 ${pageNumber} 页没有数据`);
                this.stats.failedPages++;
                break;
            }
        }
        
        this.stats.endTime = new Date();
        await this.generateReport();
        console.log('🎉 Buscar爬取任务完成！');
    }

    async scrapePageWithBuscar(pageNumber) {
        const url = pageNumber === 1 ? this.config.baseUrl : `${this.config.baseUrl}?page=${pageNumber}`;
        
        try {
            console.log(`  正在访问: ${url}`);
            
            // 只加载一次页面
            await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: this.config.timeout
            });
            
            console.log('  ✅ 页面加载完成');
            await this.delay(2000);
            
            // 检查是否已有结果
            let hasResults = await this.checkIfResultsLoaded();
            
            if (!hasResults) {
                console.log('  需要点击Buscar按钮...');
                hasResults = await this.clickBuscarButton();
            }
            
            if (!hasResults) {
                console.log('  Buscar按钮点击后仍未显示结果');
                return null;
            }
            
            // 等待结果加载
            await this.delay(5000);
            
            // 截图记录
            await this.page.screenshot({
                path: path.join(this.config.screenshotsDir, `buscar-page-${pageNumber}.png`)
            });
            
            // 提取案件数据
            const cases = await this.extractCaseData();
            return cases;
            
        } catch (error) {
            console.error(`爬取第 ${pageNumber} 页时出错:`, error.message);
            return null;
        }
    }

    async clickBuscarButton() {
        console.log('  查找并点击Buscar按钮...');
        
        try {
            // 精确查找Buscar按钮
            const buscarButton = await this.page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
                return buttons.find(btn => {
                    const text = btn.textContent?.trim() || btn.value?.trim() || '';
                    return text.toLowerCase().includes('buscar');
                });
            });
            
            if (buscarButton.asElement()) {
                const buttonElement = buscarButton.asElement();
                const text = await buttonElement.evaluate(el => el.textContent?.trim() || el.value?.trim() || '');
                console.log(`  找到Buscar按钮: "${text}"`);
                
                const isVisible = await buttonElement.isVisible();
                const isEnabled = await buttonElement.isEnabled();
                
                if (isVisible && isEnabled) {
                    await buttonElement.scrollIntoViewIfNeeded();
                    await this.delay(1000);
                    
                    await buttonElement.click({ delay: 100 });
                    console.log('  ✅ Buscar按钮点击成功');
                    
                    // 等待结果加载
                    await this.delay(8000);
                    
                    const resultsLoaded = await this.checkIfResultsLoaded();
                    return resultsLoaded;
                }
            }
            
            console.log('  ❌ 未找到可点击的Buscar按钮');
            return false;
            
        } catch (error) {
            console.log('  点击Buscar按钮失败:', error.message);
            return false;
        }
    }

    async checkIfResultsLoaded() {
        try {
            const hasResults = await this.page.evaluate(() => {
                const text = document.body.textContent;
                return text.includes('NCMC') || 
                       text.includes('AMBER') ||
                       document.querySelector('.search-results, .results, tbody, table') !== null;
            });
            
            return hasResults;
        } catch (error) {
            return false;
        }
    }

    async extractCaseData() {
        try {
            console.log('  提取案件数据...');
            
            // 从页面文本中提取案件号
            const caseNumbers = await this.page.evaluate(() => {
                const text = document.body.textContent;
                const ncmcMatches = text.match(/NCMC\d+/g) || [];
                const amberMatches = text.match(/AMBER\d+/g) || [];
                return [...ncmcMatches, ...amberMatches];
            });
            
            const cases = caseNumbers.map(caseNumber => ({
                caseNumber: caseNumber,
                name: '',
                age: '',
                missingDate: '',
                location: '',
                photoUrls: [],
                description: '',
                detailUrl: '',
                language: 'spanish',
                extractedAt: new Date().toISOString()
            }));
            
            console.log(`  ✅ 提取到 ${cases.length} 个案件`);
            return cases;
            
        } catch (error) {
            console.error('提取案件数据时出错:', error.message);
            return [];
        }
    }

    async goToNextPage() {
        console.log('  尝试翻到下一页...');
        
        try {
            // 查找下一页链接
            const nextSelectors = [
                'a[href*="page="]',
                'button:contains("Next")',
                'button:contains("Siguiente")',
                '.next-page',
                '.pagination-next'
            ];
            
            for (const selector of nextSelectors) {
                try {
                    const nextElement = await this.page.$(selector);
                    if (nextElement) {
                        await nextElement.click();
                        console.log('  ✅ 下一页按钮点击成功');
                        await this.delay(3000);
                        return true;
                    }
                } catch (error) {
                    // 忽略选择器错误
                }
            }
            
            console.log('  ❌ 未找到下一页按钮');
            return false;
            
        } catch (error) {
            console.log('  翻页失败:', error.message);
            return false;
        }
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
        
        console.log('\n📊 === Buscar爬取报告 ===');
        console.log(`总案件数: ${this.stats.totalCases}`);
        console.log(`成功页面: ${this.stats.successfulPages}`);
        console.log(`失败页面: ${this.stats.failedPages}`);
        console.log(`耗时: ${minutes}分${seconds}秒`);
        console.log(`数据文件: ${this.config.outputFile}`);
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

// 运行爬虫
async function runBuscarScraper() {
    const scraper = new BuscarMissingKidsScraper();
    
    try {
        await scraper.init();
        await scraper.scrape();
    } catch (error) {
        console.error('Buscar爬虫运行出错:', error);
    } finally {
        await scraper.close();
    }
}

if (require.main === module) {
    runBuscarScraper().catch(console.error);
}

module.exports = BuscarMissingKidsScraper;