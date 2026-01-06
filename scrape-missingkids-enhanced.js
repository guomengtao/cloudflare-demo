const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class EnhancedMissingKidsScraper {
    constructor() {
        this.config = {
            baseUrl: 'https://www.missingkids.org/gethelpnow/search/poster-search-results',
            maxPages: 100,
            delayBetweenRequests: 1500,
            outputFile: 'missingkids-enhanced-data.json',
            screenshotsDir: 'scraping-screenshots',
            userAgents: [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
        console.log('🚀 初始化增强版爬虫...');
        
        // 创建目录
        if (!fs.existsSync(this.config.screenshotsDir)) {
            fs.mkdirSync(this.config.screenshotsDir);
        }
        
        this.browser = await chromium.launch({
            headless: true,
            slowMo: 50
        });
        
        const context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: this.getRandomUserAgent()
        });
        
        this.page = await context.newPage();
        
        // 设置请求拦截，只加载必要资源
        await this.page.route('**/*', route => {
            const resourceType = route.request().resourceType();
            if (['image', 'font', 'media'].includes(resourceType)) {
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
        let hasMorePages = true;
        
        while (hasMorePages && pageNumber <= this.config.maxPages) {
            console.log(`\n=== 正在处理第 ${pageNumber} 页 ===`);
            
            const pageData = await this.scrapePage(pageNumber);
            
            if (pageData && pageData.length > 0) {
                this.data = this.data.concat(pageData);
                this.stats.successfulPages++;
                this.stats.totalCases += pageData.length;
                
                console.log(`✅ 第 ${pageNumber} 页成功爬取 ${pageData.length} 个案件`);
                
                // 保存进度
                await this.saveProgress();
                
                pageNumber++;
                await this.delay(this.config.delayBetweenRequests);
            } else {
                console.log(`❌ 第 ${pageNumber} 页没有数据或爬取失败`);
                this.stats.failedPages++;
                hasMorePages = false;
            }
        }
        
        this.stats.endTime = new Date();
        await this.generateReport();
        console.log('🎉 爬取任务完成！');
    }

    async scrapePage(pageNumber) {
        const url = `${this.config.baseUrl}?page=${pageNumber}`;
        
        try {
            await this.page.goto(url, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            
            // 检查是否到达最后一页
            const isLastPage = await this.page.evaluate(() => {
                const noResults = document.querySelector('.no-results');
                const pagination = document.querySelector('.pagination');
                return !!noResults || !pagination;
            });
            
            if (isLastPage) {
                console.log('📄 已到达最后一页');
                return null;
            }
            
            // 截图记录
            await this.page.screenshot({
                path: path.join(this.config.screenshotsDir, `page-${pageNumber}.png`)
            });
            
            // 提取案件数据
            const cases = await this.page.evaluate(() => {
                const caseElements = document.querySelectorAll('.poster-card, .search-result-item');
                const results = [];
                
                caseElements.forEach(element => {
                    try {
                        const data = {};
                        
                        // 提取姓名和案件号
                        const nameElement = element.querySelector('.name, .poster-name, h3');
                        data.name = nameElement?.textContent?.trim() || '';
                        
                        // 提取案件号（从链接或文本中提取）
                        const caseLink = element.querySelector('a[href*="/poster/"]');
                        if (caseLink) {
                            const href = caseLink.getAttribute('href');
                            const caseMatch = href.match(/\/(NCMC|AMBER)\/(\d+)/);
                            if (caseMatch) {
                                data.caseNumber = `${caseMatch[1]}${caseMatch[2]}`;
                                data.detailUrl = `https://www.missingkids.org${href}`;
                            }
                        }
                        
                        // 提取年龄
                        const ageElement = element.querySelector('.age, .missing-age');
                        data.age = ageElement?.textContent?.trim() || '';
                        
                        // 提取失踪日期
                        const dateElement = element.querySelector('.missing-date, .date');
                        data.missingDate = dateElement?.textContent?.trim() || '';
                        
                        // 提取地点
                        const locationElement = element.querySelector('.location, .missing-location');
                        data.location = locationElement?.textContent?.trim() || '';
                        
                        // 提取照片（最多3张）
                        const photoElements = element.querySelectorAll('img[src*="photographs"]');
                        data.photos = Array.from(photoElements)
                            .slice(0, 3)
                            .map(img => img.src)
                            .filter(src => src.includes('missingkids.org'));
                        
                        // 提取描述
                        const descElement = element.querySelector('.description, .case-details');
                        data.description = descElement?.textContent?.trim() || '';
                        
                        if (data.name && data.caseNumber) {
                            results.push(data);
                        }
                    } catch (error) {
                        console.error('提取案件数据时出错:', error);
                    }
                });
                
                return results;
            });
            
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
                casesWithAge: this.data.filter(c => c.age).length
            },
            fileLocation: path.resolve(this.config.outputFile)
        };
        
        const reportFile = 'scraping-report.json';
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log('\n📊 爬取报告:');
        console.log(`   总案件数: ${report.scrapingSession.totalCases}`);
        console.log(`   总页数: ${report.scrapingSession.totalPages}`);
        console.log(`   耗时: ${report.scrapingSession.duration}`);
        console.log(`   有照片的案件: ${report.dataQuality.casesWithPhotos}`);
        console.log(`   有详情页链接的案件: ${report.dataQuality.casesWithDetailUrl}`);
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
    const scraper = new EnhancedMissingKidsScraper();
    
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

module.exports = EnhancedMissingKidsScraper;