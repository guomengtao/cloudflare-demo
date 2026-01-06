const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class OptimizedMissingKidsScraper {
    constructor() {
        this.config = {
            baseUrl: 'https://www.missingkids.org/gethelpnow/search/poster-search-results',
            maxPages: 100,
            delayBetweenRequests: 2000,
            timeout: 60000, // 增加超时时间到60秒
            outputFile: 'missingkids-data.json',
            screenshotsDir: 'scraping-screenshots',
            userAgents: [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
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
        console.log('🚀 初始化优化版爬虫...');
        
        // 创建目录
        if (!fs.existsSync(this.config.screenshotsDir)) {
            fs.mkdirSync(this.config.screenshotsDir);
        }
        
        this.browser = await chromium.launch({
            headless: true,
            slowMo: 100 // 增加操作间隔
        });
        
        const context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: this.getRandomUserAgent(),
            // 禁用图片加载以加快速度
            ignoreHTTPSErrors: true
        });
        
        this.page = await context.newPage();
        
        // 设置更宽松的超时
        this.page.setDefaultTimeout(60000);
        this.page.setDefaultNavigationTimeout(60000);
        
        // 拦截不必要的资源
        await this.page.route('**/*', route => {
            const resourceType = route.request().resourceType();
            // 只加载文档、脚本和XHR请求
            if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
                route.abort();
            } else {
                route.continue();
            }
        });
        
        this.stats.startTime = new Date();
        console.log('✅ 爬虫初始化完成');
    }

    getRandomUserAgent() {
        return this.config.userAgents[Math.floor(Math.random() * this.config.userAgents.length)];
    }

    async scrape() {
        console.log('📖 开始爬取失踪儿童数据...');
        
        let pageNumber = 1;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 3;
        
        while (pageNumber <= this.config.maxPages && consecutiveFailures < maxConsecutiveFailures) {
            console.log(`\n=== 正在处理第 ${pageNumber} 页 ===`);
            
            const pageData = await this.scrapePageWithRetry(pageNumber, 3); // 重试3次
            
            if (pageData && pageData.length > 0) {
                this.data = this.data.concat(pageData);
                this.stats.successfulPages++;
                this.stats.totalCases += pageData.length;
                consecutiveFailures = 0; // 重置连续失败计数
                
                console.log(`✅ 第 ${pageNumber} 页成功爬取 ${pageData.length} 个案件`);
                
                // 保存进度
                await this.saveProgress();
                
                pageNumber++;
                await this.delay(this.config.delayBetweenRequests);
            } else {
                console.log(`❌ 第 ${pageNumber} 页爬取失败`);
                this.stats.failedPages++;
                consecutiveFailures++;
                
                if (consecutiveFailures >= maxConsecutiveFailures) {
                    console.log('⚠️  连续失败次数过多，停止爬取');
                    break;
                }
                
                // 失败后等待更长时间
                await this.delay(5000);
                pageNumber++;
            }
        }
        
        this.stats.endTime = new Date();
        await this.generateReport();
        console.log('🎉 爬取任务完成！');
    }

    async scrapePageWithRetry(pageNumber, maxRetries) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`  尝试第 ${attempt} 次爬取...`);
                const result = await this.scrapePage(pageNumber);
                if (result !== null) {
                    return result;
                }
            } catch (error) {
                console.log(`  第 ${attempt} 次尝试失败: ${error.message}`);
            }
            
            if (attempt < maxRetries) {
                await this.delay(3000); // 重试前等待3秒
            }
        }
        return null;
    }

    async scrapePage(pageNumber) {
        const url = `${this.config.baseUrl}?page=${pageNumber}`;
        
        try {
            console.log(`  正在访问: ${url}`);
            
            // 使用更宽松的加载条件
            await this.page.goto(url, { 
                waitUntil: 'domcontentloaded',
                timeout: this.config.timeout
            });
            
            // 等待页面主要内容加载
            await this.page.waitForSelector('body', { timeout: 10000 });
            
            // 检查页面是否正常加载
            const pageTitle = await this.page.title();
            console.log(`  页面标题: ${pageTitle}`);
            
            if (pageTitle.includes('Error') || pageTitle.includes('Not Found')) {
                console.log('  页面加载异常，跳过');
                return null;
            }
            
            // 检查是否到达最后一页
            const isLastPage = await this.page.evaluate(() => {
                // 多种方式检查是否到达最后一页
                const noResults = document.querySelector('.no-results, .no-records, .empty');
                const errorMessage = document.querySelector('.error, .message-error');
                const content = document.body.textContent;
                
                return !!noResults || !!errorMessage || 
                       content.includes('No results') || 
                       content.includes('没有结果') ||
                       content.includes('未找到');
            });
            
            if (isLastPage) {
                console.log('📄 已到达最后一页');
                return null;
            }
            
            // 等待搜索结果容器加载
            try {
                await this.page.waitForSelector('.search-results, .results-container, .poster-grid, table', { 
                    timeout: 15000 
                });
            } catch (error) {
                console.log('  未找到搜索结果容器，尝试直接提取数据');
            }
            
            // 截图记录
            await this.page.screenshot({
                path: path.join(this.config.screenshotsDir, `page-${pageNumber}.png`)
            });
            
            // 提取案件数据 - 使用更灵活的选择器
            const cases = await this.page.evaluate(() => {
                // 尝试多种可能的选择器
                const selectors = [
                    '.poster-card',
                    '.search-result',
                    '.result-item',
                    'tr', // 表格行
                    '.card',
                    '.item'
                ];
                
                let caseElements = [];
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        caseElements = Array.from(elements);
                        break;
                    }
                }
                
                // 如果没有找到特定元素，尝试查找包含案件信息的任何元素
                if (caseElements.length === 0) {
                    const allElements = document.querySelectorAll('div, tr, li');
                    caseElements = Array.from(allElements).filter(el => {
                        const text = el.textContent || '';
                        return text.includes('NCMC') || text.includes('AMBER') || 
                               text.includes('Missing') || text.includes('失踪');
                    });
                }
                
                const results = [];
                
                caseElements.forEach(element => {
                    try {
                        const data = {};
                        const elementText = element.textContent || '';
                        
                        // 提取姓名 - 尝试多种模式
                        const nameMatch = elementText.match(/([A-Z][A-Z\s]+)(?=\s*(?:AMBER|NCMC|\d))/);
                        if (nameMatch) {
                            data.name = nameMatch[1].trim();
                        }
                        
                        // 提取案件号
                        const caseMatch = elementText.match(/(NCMC|AMBER)\s*(\d+)/i);
                        if (caseMatch) {
                            data.caseNumber = `${caseMatch[1].toUpperCase()}${caseMatch[2]}`;
                        }
                        
                        // 提取详情页链接
                        const links = element.querySelectorAll('a[href*="/poster/"]');
                        if (links.length > 0) {
                            const href = links[0].getAttribute('href');
                            data.detailUrl = href.startsWith('http') ? href : `https://www.missingkids.org${href}`;
                        }
                        
                        // 提取照片
                        const images = element.querySelectorAll('img');
                        data.photos = Array.from(images)
                            .slice(0, 3)
                            .map(img => img.src)
                            .filter(src => src && src.includes('missingkids.org'));
                        
                        // 提取其他信息
                        data.rawText = elementText.substring(0, 200); // 保存部分原始文本用于调试
                        
                        if (data.name && data.caseNumber) {
                            results.push(data);
                        }
                    } catch (error) {
                        console.error('提取案件数据时出错:', error);
                    }
                });
                
                return results;
            });
            
            console.log(`  找到 ${cases.length} 个案件`);
            return cases;
            
        } catch (error) {
            console.error(`爬取第 ${pageNumber} 页时出错:`, error.message);
            return null;
        }
    }

    async saveProgress() {
        const output = {
            metadata: {
                scrapedAt: new Date().toISOString(),
                totalPages: this.stats.successfulPages,
                totalCases: this.stats.totalCases,
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
                totalCases: this.stats.totalCases
            },
            dataQuality: {
                casesWithPhotos: this.data.filter(c => c.photos && c.photos.length > 0).length,
                casesWithDetailUrl: this.data.filter(c => c.detailUrl).length,
                uniqueCases: new Set(this.data.map(c => c.caseNumber)).size
            },
            fileLocation: path.resolve(this.config.outputFile)
        };
        
        const reportFile = 'scraping-report.json';
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log('\n📊 爬取报告:');
        console.log(`   总案件数: ${report.scrapingSession.totalCases}`);
        console.log(`   总页数: ${report.scrapingSession.totalPages}`);
        console.log(`   失败页数: ${report.scrapingSession.failedPages}`);
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
async function runScraper() {
    const scraper = new OptimizedMissingKidsScraper();
    
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
    runScraper().catch(console.error);
}

module.exports = OptimizedMissingKidsScraper;