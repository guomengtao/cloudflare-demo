const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PuppeteerMissingKidsScraper {
    constructor() {
        this.baseUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.maxPages = 10;
        this.requestDelay = 3000;
        this.timeout = 60000;
        this.dataDir = path.join(__dirname, 'puppeteer-data');
        this.screenshotsDir = path.join(__dirname, 'puppeteer-screenshots');
        
        if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir);
        if (!fs.existsSync(this.screenshotsDir)) fs.mkdirSync(this.screenshotsDir);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async initBrowser() {
        console.log('🖥️  启动Puppeteer浏览器...');
        
        const browser = await puppeteer.launch({
            headless: false, // 显示浏览器界面
            slowMo: 100, // 操作延迟，便于观察
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });
        
        const page = await browser.newPage();
        
        // 设置视口和User-Agent
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        return { browser, page };
    }

    async scrapePage(page, pageNumber) {
        try {
            console.log(`📄 正在处理第 ${pageNumber} 页...`);
            
            // 导航到页面
            await page.goto(this.baseUrl, { 
                waitUntil: 'networkidle2', 
                timeout: this.timeout 
            });
            
            // 等待页面加载
            await page.waitForTimeout(2000);
            
            // 尝试点击Buscar按钮
            const buscarClicked = await this.clickBuscarButton(page);
            
            if (buscarClicked) {
                console.log('✅ Buscar按钮点击成功');
                await page.waitForTimeout(3000); // 等待结果加载
            }
            
            // 检查是否有案件数据
            const hasCases = await this.checkForCases(page);
            
            if (!hasCases) {
                console.log('⚠️  未找到案件数据，尝试其他方法...');
                return { success: false, cases: [] };
            }
            
            // 提取案件数据
            const cases = await this.extractCases(page, pageNumber);
            
            // 截图
            await page.screenshot({ 
                path: path.join(this.screenshotsDir, `page-${pageNumber}.png`),
                fullPage: true 
            });
            
            console.log(`✅ 第 ${pageNumber} 页成功提取 ${cases.length} 个案件`);
            
            return { success: true, cases };
            
        } catch (error) {
            console.error(`❌ 处理第 ${pageNumber} 页失败:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async clickBuscarButton(page) {
        try {
            // 尝试多种方式查找Buscar按钮
            const buttonSelectors = [
                'button:contains("Buscar")',
                'button:contains("Search")',
                'input[type="submit"]',
                'input[value*="Buscar"]',
                'input[value*="Search"]',
                '.btn-primary',
                '.btn-search',
                '[class*="buscar"]',
                '[class*="search"]'
            ];
            
            for (const selector of buttonSelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        await button.click();
                        await page.waitForTimeout(1000);
                        return true;
                    }
                } catch (error) {
                    // 继续尝试下一个选择器
                    continue;
                }
            }
            
            // 使用JavaScript查找包含"Buscar"文本的按钮
            const buscarClicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
                const buscarButton = buttons.find(btn => 
                    btn.textContent && btn.textContent.toLowerCase().includes('buscar') ||
                    btn.value && btn.value.toLowerCase().includes('buscar')
                );
                
                if (buscarButton) {
                    buscarButton.click();
                    return true;
                }
                return false;
            });
            
            return buscarClicked;
            
        } catch (error) {
            console.log('点击Buscar按钮失败:', error.message);
            return false;
        }
    }

    async checkForCases(page) {
        return await page.evaluate(() => {
            const text = document.body.textContent.toLowerCase();
            const indicators = ['ncmc', 'amber', 'caso', 'desaparecido', 'missing', 'child'];
            return indicators.some(indicator => text.includes(indicator));
        });
    }

    async extractCases(page, pageNumber) {
        return await page.evaluate((pageNumber) => {
            const cases = [];
            
            // 查找案件卡片
            const cardSelectors = [
                '.poster-card',
                '.case-card',
                '.search-result',
                '.result-item'
            ];
            
            cardSelectors.forEach(selector => {
                const cards = document.querySelectorAll(selector);
                cards.forEach(card => {
                    const text = card.textContent;
                    
                    // 提取案件编号
                    const ncmcMatch = text.match(/NCMC\s*(\d+)/i);
                    const amberMatch = text.match(/AMBER\s*(\d+)/i);
                    
                    if (ncmcMatch || amberMatch) {
                        const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
                        const locationMatch = text.match(/(?:de|from)\s+([^,]+)/i);
                        
                        cases.push({
                            caseNumber: ncmcMatch ? `NCMC${ncmcMatch[1]}` : `AMBER${amberMatch[1]}`,
                            name: nameMatch ? nameMatch[1] : 'Desconocido',
                            location: locationMatch ? locationMatch[1] : 'Ubicación desconocida',
                            page: pageNumber,
                            selector: selector
                        });
                    }
                });
            });
            
            return cases;
        }, pageNumber);
    }

    async scrape() {
        console.log('🚀 开始使用Puppeteer抓取missingkids.org西班牙语版...');
        console.log('📝 框架: Puppeteer (轻量级浏览器自动化)');
        
        const { browser, page } = await this.initBrowser();
        const allCases = [];
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 3;

        try {
            for (let pageNum = 1; pageNum <= this.maxPages; pageNum++) {
                console.log(`\n--- 第 ${pageNum} 页 ---`);
                
                const result = await this.scrapePage(page, pageNum);
                
                if (result.success && result.cases.length > 0) {
                    consecutiveFailures = 0;
                    allCases.push(...result.cases);
                    console.log(`📊 当前总计: ${allCases.length} 个案件`);
                    this.saveProgress(allCases, pageNum);
                } else {
                    consecutiveFailures++;
                    console.log(`⚠️  连续失败次数: ${consecutiveFailures}/${maxConsecutiveFailures}`);
                    
                    if (consecutiveFailures >= maxConsecutiveFailures) {
                        console.log('❌ 连续失败次数过多，停止抓取');
                        break;
                    }
                }
                
                if (pageNum < this.maxPages) {
                    console.log(`⏳ 等待 ${this.requestDelay/1000} 秒后继续...`);
                    await this.delay(this.requestDelay);
                }
            }
            
            this.generateReport(allCases);
            console.log(`\n🎉 抓取完成! 总共获取 ${allCases.length} 个案件`);
            
        } finally {
            await browser.close();
        }
        
        return allCases;
    }

    saveProgress(cases, currentPage) {
        const progressFile = path.join(this.dataDir, 'scraping-progress.json');
        const progress = {
            totalCases: cases.length,
            currentPage: currentPage,
            lastUpdate: new Date().toISOString(),
            cases: cases
        };
        fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    }

    generateReport(cases) {
        const reportFile = path.join(this.dataDir, 'scraping-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            framework: 'Puppeteer',
            totalCases: cases.length,
            uniqueCases: [...new Set(cases.map(c => c.caseNumber))].length,
            pagesScraped: Math.max(...cases.map(c => c.page), 0),
            casesByType: {
                NCMC: cases.filter(c => c.caseNumber.startsWith('NCMC')).length,
                AMBER: cases.filter(c => c.caseNumber.startsWith('AMBER')).length
            },
            allCases: cases
        };
        
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`📋 报告已保存: ${reportFile}`);
    }
}

// 运行抓取
async function main() {
    const scraper = new PuppeteerMissingKidsScraper();
    
    try {
        await scraper.scrape();
    } catch (error) {
        console.error('❌ 抓取过程出错:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = PuppeteerMissingKidsScraper;