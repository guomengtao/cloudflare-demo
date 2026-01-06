const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class InteractiveMissingKidsScraper {
    constructor() {
        this.config = {
            baseUrl: 'https://www.missingkids.org/gethelpnow/search/poster-search-results',
            maxPages: 50, // 每页20个，50页约1000个案件
            delayBetweenRequests: 3000,
            submitRetryDelay: 5000, // Submit按钮重试间隔
            maxSubmitRetries: 5, // Submit按钮最大重试次数
            timeout: 60000,
            outputFile: 'missingkids-interactive-data.json',
            screenshotsDir: 'interactive-screenshots'
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
        console.log('🚀 初始化交互式爬虫...');
        
        if (!fs.existsSync(this.config.screenshotsDir)) {
            fs.mkdirSync(this.config.screenshotsDir);
        }
        
        this.browser = await chromium.launch({
            headless: false, // 非无头模式以便观察
            slowMo: 200 // 减慢操作速度
        });
        
        const context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        this.page = await context.newPage();
        this.page.setDefaultTimeout(this.config.timeout);
        
        this.stats.startTime = new Date();
        console.log('✅ 爬虫初始化完成');
    }

    async scrape() {
        console.log('📖 开始爬取失踪儿童数据（交互式）...');
        
        let pageNumber = 1;
        
        while (pageNumber <= this.config.maxPages) {
            console.log(`\n=== 正在处理第 ${pageNumber} 页 ===`);
            
            const pageData = await this.scrapePageWithSubmit(pageNumber);
            
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
        console.log('🎉 爬取任务完成！');
    }

    async scrapePageWithSubmit(pageNumber) {
        const url = pageNumber === 1 ? this.config.baseUrl : `${this.config.baseUrl}?page=${pageNumber}`;
        
        try {
            console.log(`  正在访问: ${url}`);
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            
            // 等待页面加载完成
            await this.page.waitForSelector('body', { timeout: 10000 });
            
            // 检查是否已经显示结果（可能是从上一页跳转过来的）
            let hasResults = await this.checkIfResultsLoaded();
            
            if (!hasResults) {
                console.log('  需要点击Submit按钮...');
                hasResults = await this.clickSubmitButton();
            }
            
            if (!hasResults) {
                console.log('  Submit按钮点击后仍未显示结果');
                return null;
            }
            
            // 等待结果加载
            await this.page.waitForSelector('.search-results, .results, tbody, table', { timeout: 15000 });
            
            // 截图记录
            await this.page.screenshot({
                path: path.join(this.config.screenshotsDir, `page-${pageNumber}-after-submit.png`)
            });
            
            // 提取案件数据
            const cases = await this.extractCaseData();
            return cases;
            
        } catch (error) {
            console.error(`爬取第 ${pageNumber} 页时出错:`, error.message);
            return null;
        }
    }

    async clickSubmitButton() {
        for (let attempt = 1; attempt <= this.config.maxSubmitRetries; attempt++) {
            console.log(`  尝试第 ${attempt} 次点击Submit按钮...`);
            
            try {
                // 查找Submit按钮 - 尝试多种选择器
                const submitSelectors = [
                    'input[type="submit"]',
                    'button[type="submit"]',
                    'input[value*="Submit"]',
                    'button[value*="Submit"]',
                    '.submit-btn',
                    '#submit',
                    'input[value*="搜索"]',
                    'button[value*="搜索"]'
                ];
                
                let submitButton = null;
                for (const selector of submitSelectors) {
                    submitButton = await this.page.$(selector);
                    if (submitButton) {
                        console.log(`  找到Submit按钮: ${selector}`);
                        break;
                    }
                }
                
                if (!submitButton) {
                    // 如果没找到标准按钮，尝试查找包含"Submit"文本的按钮
                    const allButtons = await this.page.$$('button, input[type="button"], input[type="submit"]');
                    for (const button of allButtons) {
                        const text = await button.evaluate(el => el.textContent || el.value || '');
                        if (text.toLowerCase().includes('submit') || text.includes('搜索')) {
                            submitButton = button;
                            console.log(`  通过文本找到Submit按钮: ${text}`);
                            break;
                        }
                    }
                }
                
                if (submitButton) {
                    await submitButton.click();
                    this.stats.submitClicks++;
                    
                    // 等待结果加载
                    await this.delay(3000);
                    
                    // 检查是否显示结果
                    const resultsLoaded = await this.checkIfResultsLoaded();
                    if (resultsLoaded) {
                        console.log('  ✅ Submit按钮点击成功，结果已加载');
                        return true;
                    } else {
                        console.log('  ⚠️  Submit按钮已点击，但结果尚未加载，等待中...');
                        await this.delay(this.config.submitRetryDelay);
                    }
                } else {
                    console.log('  ❌ 未找到Submit按钮');
                    // 尝试直接等待结果（可能不需要点击）
                    await this.delay(5000);
                    const resultsLoaded = await this.checkIfResultsLoaded();
                    if (resultsLoaded) {
                        console.log('  ✅ 页面自动加载了结果');
                        return true;
                    }
                }
                
            } catch (error) {
                console.log(`  第 ${attempt} 次点击失败:`, error.message);
            }
            
            if (attempt < this.config.maxSubmitRetries) {
                await this.delay(this.config.submitRetryDelay);
            }
        }
        
        return false;
    }

    async checkIfResultsLoaded() {
        try {
            // 检查是否有结果元素
            const resultSelectors = [
                '.search-results',
                '.results',
                'table tbody tr',
                '.poster-item',
                '.case-item'
            ];
            
            for (const selector of resultSelectors) {
                const elements = await this.page.$$(selector);
                if (elements.length > 0) {
                    console.log(`  检测到结果元素: ${selector} (${elements.length} 个)`);
                    return true;
                }
            }
            
            // 检查页面文本是否包含结果信息
            const pageText = await this.page.evaluate(() => document.body.textContent);
            if (pageText.includes('NCMC') || pageText.includes('AMBER') || pageText.includes('Results')) {
                console.log('  页面文本包含案件信息');
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    async extractCaseData() {
        try {
            const cases = await this.page.evaluate(() => {
                const results = [];
                
                // 尝试多种可能的结果容器
                const containers = [
                    '.search-results',
                    '.results',
                    'table tbody',
                    '.results-container'
                ];
                
                let caseElements = [];
                for (const container of containers) {
                    const containerEl = document.querySelector(container);
                    if (containerEl) {
                        // 在容器内查找案件元素
                        const elements = containerEl.querySelectorAll('tr, .item, .card, .poster');
                        if (elements.length > 0) {
                            caseElements = Array.from(elements);
                            break;
                        }
                    }
                }
                
                // 如果没找到容器，直接查找案件相关元素
                if (caseElements.length === 0) {
                    caseElements = Array.from(document.querySelectorAll('tr, .item, .card, .poster'));
                }
                
                caseElements.forEach(element => {
                    try {
                        const data = {};
                        const text = element.textContent || '';
                        
                        // 提取案件号
                        const caseMatch = text.match(/(NCMC|AMBER)\s*(\d+)/i);
                        if (caseMatch) {
                            data.caseNumber = `${caseMatch[1].toUpperCase()}${caseMatch[2]}`;
                        }
                        
                        // 提取姓名（大写字母组成的名字）
                        const nameMatch = text.match(/([A-Z][A-Z\s]+[A-Z])(?=\s*(?:AMBER|NCMC|\d|Missing))/);
                        if (nameMatch) {
                            data.name = nameMatch[1].trim();
                        }
                        
                        // 提取详情页链接
                        const link = element.querySelector('a[href*="/poster/"]');
                        if (link) {
                            const href = link.getAttribute('href');
                            data.detailUrl = href.startsWith('http') ? href : `https://www.missingkids.org${href}`;
                        }
                        
                        // 提取照片
                        const images = element.querySelectorAll('img');
                        data.photos = Array.from(images)
                            .slice(0, 3)
                            .map(img => img.src)
                            .filter(src => src);
                        
                        // 保存原始文本用于调试
                        data.rawText = text.substring(0, 300).replace(/\s+/g, ' ').trim();
                        
                        if (data.caseNumber) {
                            results.push(data);
                        }
                    } catch (error) {
                        console.error('提取案件数据时出错:', error);
                    }
                });
                
                return results;
            });
            
            console.log(`  提取到 ${cases.length} 个案件`);
            return cases;
            
        } catch (error) {
            console.error('提取数据时出错:', error.message);
            return [];
        }
    }

    async goToNextPage() {
        try {
            console.log('  尝试翻到下一页...');
            
            // 查找下一页按钮
            const nextPageSelectors = [
                'a[href*="page="]',
                '.next-page',
                '.pagination a',
                'input[value*="Next"]',
                'button[value*="Next"]'
            ];
            
            let nextPageLink = null;
            for (const selector of nextPageSelectors) {
                const links = await this.page.$$(selector);
                for (const link of links) {
                    const href = await link.getAttribute('href');
                    const text = await link.evaluate(el => el.textContent || '');
                    if (href && href.includes('page=') && !text.includes('Previous')) {
                        nextPageLink = link;
                        console.log(`  找到下一页链接: ${href}`);
                        break;
                    }
                }
                if (nextPageLink) break;
            }
            
            if (nextPageLink) {
                await nextPageLink.click();
                await this.delay(3000);
                return true;
            }
            
            console.log('  未找到下一页链接');
            return false;
            
        } catch (error) {
            console.error('翻页时出错:', error.message);
            return false;
        }
    }

    async saveProgress() {
        const output = {
            metadata: {
                scrapedAt: new Date().toISOString(),
                totalPages: this.stats.successfulPages,
                totalCases: this.stats.totalCases,
                submitClicks: this.stats.submitClicks,
                source: this.config.baseUrl
            },
            cases: this.data
        };
        
        fs.writeFileSync(this.config.outputFile, JSON.stringify(output, null, 2));
        console.log(`💾 进度已保存: ${this.stats.totalCases} 个案件`);
    }

    async generateReport() {
        const duration = this.stats.endTime - this.stats.startTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        const report = {
            scrapingSession: {
                startTime: this.stats.startTime.toISOString(),
                endTime: this.stats.endTime.toISOString(),
                duration: `${minutes}分${seconds}秒`,
                totalPages: this.stats.successfulPages,
                failedPages: this.stats.failedPages,
                submitClicks: this.stats.submitClicks,
                totalCases: this.stats.totalCases
            },
            dataQuality: {
                casesWithPhotos: this.data.filter(c => c.photos && c.photos.length > 0).length,
                casesWithDetailUrl: this.data.filter(c => c.detailUrl).length,
                uniqueCases: new Set(this.data.map(c => c.caseNumber)).size
            },
            fileLocation: path.resolve(this.config.outputFile)
        };
        
        const reportFile = 'interactive-scraping-report.json';
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log('\n📊 交互式爬取报告:');
        console.log(`   总案件数: ${report.scrapingSession.totalCases}`);
        console.log(`   总页数: ${report.scrapingSession.totalPages}`);
        console.log(`   Submit点击次数: ${report.scrapingSession.submitClicks}`);
        console.log(`   耗时: ${report.scrapingSession.duration}`);
        console.log(`   有照片的案件: ${report.dataQuality.casesWithPhotos}`);
        console.log(`   有详情页链接的案件: ${report.dataQuality.casesWithDetailUrl}`);
        console.log(`   唯一案件数: ${report.dataQuality.uniqueCases}`);
        console.log(`   数据文件: ${report.fileLocation}`);
    }

    delay(ms) {
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
async function runInteractiveScraper() {
    const scraper = new InteractiveMissingKidsScraper();
    
    try {
        await scraper.init();
        await scraper.scrape();
    } catch (error) {
        console.error('❌ 爬取失败:', error);
    } finally {
        await scraper.close();
    }
}

// 命令行接口
if (require.main === module) {
    runInteractiveScraper().catch(console.error);
}

module.exports = InteractiveMissingKidsScraper;