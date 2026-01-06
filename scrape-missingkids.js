const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    baseUrl: 'https://www.missingkids.org/gethelpnow/search/poster-search-results',
    maxPages: 100, // 最大页数，每页约40条数据
    delayBetweenPages: 2000, // 页面间延迟（毫秒）
    outputFile: 'missingkids-data.json',
    screenshotDir: 'screenshots'
};

// 创建输出目录
if (!fs.existsSync(CONFIG.screenshotDir)) {
    fs.mkdirSync(CONFIG.screenshotDir);
}

class MissingKidsScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.allData = [];
        this.currentPage = 1;
    }

    async init() {
        console.log('正在启动浏览器...');
        this.browser = await chromium.launch({ 
            headless: true,
            slowMo: 100 // 减慢操作速度，避免被检测
        });
        
        this.page = await this.browser.newContext().then(ctx => ctx.newPage());
        
        // 设置用户代理和视口
        await this.page.setViewportSize({ width: 1920, height: 1080 });
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        console.log('浏览器启动成功');
    }

    async scrapePage(pageNumber) {
        console.log(`正在爬取第 ${pageNumber} 页...`);
        
        const url = `${CONFIG.baseUrl}?page=${pageNumber}`;
        
        try {
            await this.page.goto(url, { waitUntil: 'networkidle' });
            
            // 等待搜索结果加载
            await this.page.waitForSelector('.search-results', { timeout: 10000 });
            
            // 截图记录当前页面状态
            await this.page.screenshot({ 
                path: path.join(CONFIG.screenshotDir, `page-${pageNumber}.png`),
                fullPage: true 
            });
            
            // 提取当前页面的所有案件卡片
            const cases = await this.page.$$eval('.poster-card', (cards) => {
                return cards.map(card => {
                    // 提取基本信息
                    const name = card.querySelector('.poster-name')?.textContent?.trim() || '';
                    const caseNumber = card.querySelector('.case-number')?.textContent?.trim() || '';
                    const age = card.querySelector('.age')?.textContent?.trim() || '';
                    const missingDate = card.querySelector('.missing-date')?.textContent?.trim() || '';
                    const location = card.querySelector('.location')?.textContent?.trim() || '';
                    
                    // 提取照片链接
                    const photoElements = card.querySelectorAll('.poster-photo img');
                    const photos = Array.from(photoElements).map(img => img.src).filter(src => src);
                    
                    // 提取详情页链接
                    const detailLink = card.querySelector('a[href*="/poster/"]')?.href || '';
                    
                    // 提取描述信息
                    const description = card.querySelector('.description')?.textContent?.trim() || '';
                    
                    return {
                        name,
                        caseNumber,
                        age,
                        missingDate,
                        location,
                        photos,
                        detailLink,
                        description,
                        scrapedAt: new Date().toISOString()
                    };
                });
            });
            
            console.log(`第 ${pageNumber} 页找到 ${cases.length} 个案件`);
            return cases;
            
        } catch (error) {
            console.error(`爬取第 ${pageNumber} 页时出错:`, error.message);
            return [];
        }
    }

    async scrapeDetailPage(detailUrl) {
        try {
            console.log(`正在爬取详情页: ${detailUrl}`);
            
            const detailPage = await this.browser.newContext().then(ctx => ctx.newPage());
            await detailPage.goto(detailUrl, { waitUntil: 'networkidle' });
            
            // 提取详细信息
            const detailData = await detailPage.evaluate(() => {
                const data = {};
                
                // 提取所有可能的信息字段
                data.fullName = document.querySelector('.full-name')?.textContent?.trim() || '';
                data.aliases = document.querySelector('.aliases')?.textContent?.trim() || '';
                data.dateOfBirth = document.querySelector('.date-of-birth')?.textContent?.trim() || '';
                data.sex = document.querySelector('.sex')?.textContent?.trim() || '';
                data.race = document.querySelector('.race')?.textContent?.trim() || '';
                data.height = document.querySelector('.height')?.textContent?.trim() || '';
                data.weight = document.querySelector('.weight')?.textContent?.trim() || '';
                data.eyeColor = document.querySelector('.eye-color')?.textContent?.trim() || '';
                data.hairColor = document.querySelector('.hair-color')?.textContent?.trim() || '';
                
                // 提取详细描述
                data.detailedDescription = document.querySelector('.detailed-description')?.textContent?.trim() || '';
                
                // 提取联系信息
                data.contactInfo = document.querySelector('.contact-info')?.textContent?.trim() || '';
                
                // 提取所有照片（大图）
                const photoElements = document.querySelectorAll('.photo-gallery img, .main-photo img');
                data.allPhotos = Array.from(photoElements).map(img => img.src).filter(src => src);
                
                // 提取案件状态
                data.caseStatus = document.querySelector('.case-status')?.textContent?.trim() || '';
                data.lastSeen = document.querySelector('.last-seen')?.textContent?.trim() || '';
                data.circumstances = document.querySelector('.circumstances')?.textContent?.trim() || '';
                
                return data;
            });
            
            await detailPage.close();
            return detailData;
            
        } catch (error) {
            console.error(`爬取详情页 ${detailUrl} 时出错:`, error.message);
            return null;
        }
    }

    async scrapeAllPages() {
        console.log('开始爬取所有页面...');
        
        for (let pageNum = 1; pageNum <= CONFIG.maxPages; pageNum++) {
            const cases = await this.scrapePage(pageNum);
            
            if (cases.length === 0) {
                console.log(`第 ${pageNum} 页没有数据，可能已到达最后一页`);
                break;
            }
            
            // 为每个案件爬取详细信息
            for (let i = 0; i < cases.length; i++) {
                const caseData = cases[i];
                if (caseData.detailLink) {
                    const detailData = await this.scrapeDetailPage(caseData.detailLink);
                    if (detailData) {
                        cases[i] = { ...caseData, ...detailData };
                    }
                    
                    // 添加延迟，避免请求过于频繁
                    await this.delay(1000);
                }
            }
            
            this.allData = this.allData.concat(cases);
            console.log(`已爬取 ${this.allData.length} 个案件`);
            
            // 每爬取5页保存一次数据
            if (pageNum % 5 === 0) {
                await this.saveData();
            }
            
            // 页面间延迟
            await this.delay(CONFIG.delayBetweenPages);
            
            this.currentPage = pageNum;
        }
        
        await this.saveData();
        console.log('爬取完成！');
    }

    async saveData() {
        const output = {
            metadata: {
                totalCases: this.allData.length,
                lastPage: this.currentPage,
                scrapedAt: new Date().toISOString(),
                source: CONFIG.baseUrl
            },
            cases: this.allData
        };
        
        fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2));
        console.log(`数据已保存到 ${CONFIG.outputFile}，共 ${this.allData.length} 个案件`);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('浏览器已关闭');
        }
    }
}

// 主函数
async function main() {
    const scraper = new MissingKidsScraper();
    
    try {
        await scraper.init();
        await scraper.scrapeAllPages();
    } catch (error) {
        console.error('爬取过程中发生错误:', error);
    } finally {
        await scraper.close();
    }
}

// 运行爬虫
if (require.main === module) {
    main().catch(console.error);
}

module.exports = MissingKidsScraper;