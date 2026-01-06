const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class SimpleCaseUrlExtractor {
    constructor() {
        this.baseUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.outputFile = path.join(__dirname, 'case-urls-simple.txt');
    }

    async extract() {
        console.log('🚀 开始简单提取案件URL...');
        
        try {
            // 直接获取页面内容
            const response = await axios.get(this.baseUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            // 保存原始HTML用于分析
            fs.writeFileSync(path.join(__dirname, 'raw-page.html'), response.data);
            
            // 查找所有可能的案件链接
            const caseUrls = this.findAllCaseLinks($);
            
            // 保存结果
            this.saveUrls(caseUrls);
            
            console.log(`🎉 完成! 找到 ${caseUrls.length} 个案件URL`);
            console.log(`💾 结果保存在: ${this.outputFile}`);
            
            return caseUrls;
            
        } catch (error) {
            console.error('❌ 提取失败:', error.message);
            return [];
        }
    }

    findAllCaseLinks($) {
        const urls = new Set();
        
        console.log('🔍 搜索案件链接...');
        
        // 方法1: 搜索包含案件编号的链接
        $('a[href]').each((i, element) => {
            const href = $(element).attr('href');
            if (href && this.isCaseLink(href)) {
                const fullUrl = this.makeAbsoluteUrl(href);
                urls.add(fullUrl);
            }
        });
        
        // 方法2: 搜索JavaScript中的数据
        $('script').each((i, element) => {
            const scriptContent = $(element).html();
            if (scriptContent) {
                const foundUrls = this.extractUrlsFromScript(scriptContent);
                foundUrls.forEach(url => urls.add(url));
            }
        });
        
        // 方法3: 搜索数据属性中的URL
        $('[data-url], [data-href]').each((i, element) => {
            const dataUrl = $(element).attr('data-url') || $(element).attr('data-href');
            if (dataUrl && this.isCaseLink(dataUrl)) {
                const fullUrl = this.makeAbsoluteUrl(dataUrl);
                urls.add(fullUrl);
            }
        });
        
        return Array.from(urls);
    }

    isCaseLink(url) {
        const caseIndicators = [
            'NCMC', 'AMBER', 'case', 'caso', 'poster', 'cartel',
            'viewcase', 'profile', 'perfil', 'missing', 'desaparecido'
        ];
        
        return caseIndicators.some(indicator => 
            url.toLowerCase().includes(indicator.toLowerCase())
        );
    }

    makeAbsoluteUrl(url) {
        if (url.startsWith('http')) {
            return url;
        }
        if (url.startsWith('//')) {
            return 'https:' + url;
        }
        if (url.startsWith('/')) {
            return 'https://www.missingkids.org' + url;
        }
        return 'https://www.missingkids.org/' + url;
    }

    extractUrlsFromScript(scriptContent) {
        const urls = [];
        
        // 查找包含案件编号的URL模式
        const urlPatterns = [
            /https?:\/\/[^"']*NCMC\d+[^"']*/g,
            /https?:\/\/[^"']*AMBER\d+[^"']*/g,
            /\/[^"']*NCMC\d+[^"']*/g,
            /\/[^"']*AMBER\d+[^"']*/g
        ];
        
        urlPatterns.forEach(pattern => {
            const matches = scriptContent.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    if (this.isCaseLink(match)) {
                        urls.push(this.makeAbsoluteUrl(match));
                    }
                });
            }
        });
        
        return urls;
    }

    saveUrls(urls) {
        const content = urls.join('\n');
        fs.writeFileSync(this.outputFile, content);
        
        // 同时保存JSON格式
        const jsonContent = {
            timestamp: new Date().toISOString(),
            totalUrls: urls.length,
            urls: urls
        };
        fs.writeFileSync(
            this.outputFile.replace('.txt', '.json'),
            JSON.stringify(jsonContent, null, 2)
        );
    }
}

// 运行
async function main() {
    const extractor = new SimpleCaseUrlExtractor();
    await extractor.extract();
}

if (require.main === module) {
    main();
}