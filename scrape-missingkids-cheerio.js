const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class CheerioMissingKidsScraper {
    constructor() {
        this.baseUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.maxPages = 10;
        this.requestDelay = 3000; // 3秒延迟
        this.timeout = 30000; // 30秒超时
        this.dataDir = path.join(__dirname, 'cheerio-data');
        this.screenshotsDir = path.join(__dirname, 'cheerio-screenshots');
        
        // 创建目录
        if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir);
        if (!fs.existsSync(this.screenshotsDir)) fs.mkdirSync(this.screenshotsDir);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchPage(url, pageNumber = 1) {
        try {
            console.log(`📄 正在抓取第 ${pageNumber} 页: ${url}`);
            
            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                }
            });

            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const $ = cheerio.load(response.data);
            
            // 检查是否有案件数据
            const hasCases = this.checkForCases($);
            
            if (!hasCases) {
                console.log(`⚠️  第 ${pageNumber} 页未找到案件数据，可能需要进行表单提交`);
                return { success: false, $, html: response.data, needsFormSubmit: true };
            }

            // 提取案件数据
            const cases = this.extractCases($, pageNumber);
            
            console.log(`✅ 第 ${pageNumber} 页成功抓取到 ${cases.length} 个案件`);
            
            // 保存HTML
            const htmlFile = path.join(this.dataDir, `page-${pageNumber}.html`);
            fs.writeFileSync(htmlFile, response.data);
            
            return { success: true, $, html: response.data, cases, pageNumber };

        } catch (error) {
            console.error(`❌ 抓取第 ${pageNumber} 页失败:`, error.message);
            return { success: false, error: error.message };
        }
    }

    checkForCases($) {
        // 检查西班牙语页面中的案件关键词
        const caseIndicators = [
            'NCMC', 'AMBER', 'caso', 'casos', 'desaparecido', 'desaparecida',
            'poster', 'cartel', 'missing', 'child'
        ];
        
        const pageText = $('body').text().toLowerCase();
        return caseIndicators.some(indicator => pageText.includes(indicator.toLowerCase()));
    }

    extractCases($, pageNumber) {
        const cases = [];
        
        // 尝试不同的选择器来查找案件卡片
        const selectors = [
            '.poster-card',
            '.case-card', 
            '.search-result',
            '.result-item',
            '[class*="case"]',
            '[class*="poster"]',
            '[class*="result"]'
        ];

        selectors.forEach(selector => {
            $(selector).each((index, element) => {
                try {
                    const $element = $(element);
                    const caseData = this.parseCaseElement($element, $);
                    if (caseData) {
                        cases.push({
                            ...caseData,
                            page: pageNumber,
                            selector: selector
                        });
                    }
                } catch (error) {
                    console.log(`解析案件元素失败: ${error.message}`);
                }
            });
        });

        // 如果没有找到标准卡片，尝试从文本中提取案件编号
        if (cases.length === 0) {
            const textCases = this.extractCasesFromText($);
            cases.push(...textCases.map(caseData => ({
                ...caseData,
                page: pageNumber,
                source: 'text-extraction'
            })));
        }

        return cases;
    }

    parseCaseElement($element, $) {
        const text = $element.text();
        
        // 提取案件编号
        const ncmcMatch = text.match(/NCMC\s*(\d+)/i);
        const amberMatch = text.match(/AMBER\s*(\d+)/i);
        
        if (!ncmcMatch && !amberMatch) {
            return null; // 没有有效的案件编号
        }

        // 提取姓名
        const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
        
        // 提取地点
        const locationMatch = text.match(/(?:de|from|desde)\s+([^,]+(?:\s*,\s*[A-Z]{2})?)/i);

        return {
            caseNumber: ncmcMatch ? `NCMC${ncmcMatch[1]}` : `AMBER${amberMatch[1]}`,
            name: nameMatch ? nameMatch[1] : 'Desconocido',
            location: locationMatch ? locationMatch[1].trim() : 'Ubicación desconocida',
            textSnippet: text.substring(0, 200) + '...'
        };
    }

    extractCasesFromText($) {
        const cases = [];
        const text = $('body').text();
        
        // 查找所有案件编号
        const caseNumberRegex = /(NCMC\s*\d+|AMBER\s*\d+)/gi;
        const matches = text.match(caseNumberRegex);
        
        if (matches) {
            matches.forEach(match => {
                cases.push({
                    caseNumber: match.replace(/\s+/g, ''),
                    name: 'Extraído del texto',
                    location: 'Ubicación extraída del texto',
                    textSnippet: 'Extraído mediante análisis de texto'
                });
            });
        }
        
        return cases;
    }

    async scrape() {
        console.log('🚀 开始使用Cheerio抓取missingkids.org西班牙语版...');
        console.log('📝 框架: Cheerio + Axios (轻量级HTTP抓取)');
        
        const allCases = [];
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 3;

        for (let page = 1; page <= this.maxPages; page++) {
            console.log(`\n--- 第 ${page} 页 ---`);
            
            const result = await this.fetchPage(this.baseUrl, page);
            
            if (result.success) {
                consecutiveFailures = 0;
                allCases.push(...result.cases);
                
                console.log(`📊 当前总计: ${allCases.length} 个案件`);
                
                // 保存进度
                this.saveProgress(allCases, page);
                
            } else {
                consecutiveFailures++;
                console.log(`⚠️  连续失败次数: ${consecutiveFailures}/${maxConsecutiveFailures}`);
                
                if (consecutiveFailures >= maxConsecutiveFailures) {
                    console.log('❌ 连续失败次数过多，停止抓取');
                    break;
                }
            }
            
            // 延迟
            if (page < this.maxPages) {
                console.log(`⏳ 等待 ${this.requestDelay/1000} 秒后继续...`);
                await this.delay(this.requestDelay);
            }
        }

        // 生成报告
        this.generateReport(allCases);
        
        console.log(`\n🎉 抓取完成! 总共获取 ${allCases.length} 个案件`);
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
            framework: 'Cheerio + Axios',
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
    const scraper = new CheerioMissingKidsScraper();
    
    try {
        await scraper.scrape();
    } catch (error) {
        console.error('❌ 抓取过程出错:', error);
    }
}

// 直接运行或导出
if (require.main === module) {
    main();
}

module.exports = CheerioMissingKidsScraper;