const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

class SmartCaseUrlExtractor {
    constructor() {
        this.baseUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.searchUrl = 'https://api.missingkids.org/missingkids/servlet/JSONDataServlet';
        this.outputFile = path.join(__dirname, 'case-urls-smart.txt');
        this.progressFile = path.join(__dirname, 'scraping-progress-smart.json');
    }

    async extract() {
        console.log('🚀 开始智能提取案件URL...');
        console.log('📝 方法: 模拟表单提交 + API调用');
        
        try {
            // 方法1: 尝试直接API调用获取案件数据
            const apiUrls = await this.tryApiExtraction();
            
            // 方法2: 如果API失败，尝试模拟表单提交
            let formUrls = [];
            if (apiUrls.length === 0) {
                console.log('🔍 API调用失败，尝试模拟表单提交...');
                formUrls = await this.tryFormSubmission();
            }
            
            // 合并结果
            const allUrls = [...new Set([...apiUrls, ...formUrls])];
            
            // 保存结果
            this.saveUrls(allUrls);
            
            console.log(`🎉 提取完成! 总共找到 ${allUrls.length} 个唯一案件URL`);
            console.log(`💾 结果已保存: ${this.outputFile}`);
            
            return allUrls;
            
        } catch (error) {
            console.error('❌ 提取失败:', error.message);
            return [];
        }
    }

    async tryApiExtraction() {
        const urls = new Set();
        
        console.log('🔍 尝试API调用获取案件数据...');
        
        try {
            // 构建API请求参数
            const params = {
                action: 'publicSearch',
                search: 'new',
                searchLang: 'es_US',
                LanguageId: 'es_US',
                caseType: 'All',
                subjToSearch: 'child',
                orderBy: 'MostRecent',
                page: 1
            };
            
            const response = await axios.post(this.searchUrl, querystring.stringify(params), {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.baseUrl,
                    'Origin': 'https://www.missingkids.org'
                }
            });
            
            // 尝试解析API响应
            if (response.data) {
                const foundUrls = this.extractUrlsFromApiResponse(response.data);
                foundUrls.forEach(url => urls.add(url));
            }
            
        } catch (error) {
            console.log('⚠️ API调用失败:', error.message);
        }
        
        return Array.from(urls);
    }

    async tryFormSubmission() {
        const urls = new Set();
        
        console.log('🔍 模拟表单提交获取案件数据...');
        
        try {
            // 首先获取页面内容，分析表单结构
            const pageResponse = await axios.get(this.baseUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            const $ = cheerio.load(pageResponse.data);
            
            // 查找案件详情页的URL模式
            const caseUrls = this.findCaseUrlsInPage($);
            caseUrls.forEach(url => urls.add(url));
            
            // 查找JavaScript中的数据
            $('script').each((i, element) => {
                const scriptContent = $(element).html();
                if (scriptContent) {
                    const foundUrls = this.extractUrlsFromScript(scriptContent);
                    foundUrls.forEach(url => urls.add(url));
                }
            });
            
        } catch (error) {
            console.log('⚠️ 表单提交失败:', error.message);
        }
        
        return Array.from(urls);
    }

    findCaseUrlsInPage($) {
        const urls = [];
        
        // 查找包含案件编号的链接
        $('a[href*="NCMC"], a[href*="AMBER"], a[href*="poster"], a[href*="case"]').each((i, element) => {
            const href = $(element).attr('href');
            if (href && this.isCaseDetailUrl(href)) {
                const fullUrl = this.makeAbsoluteUrl(href);
                urls.push(fullUrl);
            }
        });
        
        return urls;
    }

    isCaseDetailUrl(url) {
        const casePatterns = [
            /\/poster\/(NCMC|AMBER)\/\d+/i,
            /\/case\//i,
            /NCMC\d+/i,
            /AMBER\d+/i
        ];
        
        return casePatterns.some(pattern => pattern.test(url));
    }

    extractUrlsFromApiResponse(data) {
        const urls = [];
        
        // 尝试从JSON数据中提取案件URL
        try {
            if (typeof data === 'string') {
                // 如果是字符串，尝试解析为JSON
                const jsonData = JSON.parse(data);
                this.extractUrlsFromJson(jsonData, urls);
            } else if (typeof data === 'object') {
                this.extractUrlsFromJson(data, urls);
            }
        } catch (error) {
            // 如果不是JSON，尝试正则匹配
            const urlPatterns = [
                /https?:\/\/[^"\s]*\/poster\/(NCMC|AMBER)\/\d+[^"\s]*/gi,
                /https?:\/\/[^"\s]*NCMC\d+[^"\s]*/gi,
                /https?:\/\/[^"\s]*AMBER\d+[^"\s]*/gi
            ];
            
            const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
            urlPatterns.forEach(pattern => {
                const matches = dataStr.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        if (this.isCaseDetailUrl(match)) {
                            urls.push(match);
                        }
                    });
                }
            });
        }
        
        return urls;
    }

    extractUrlsFromJson(jsonData, urls) {
        if (!jsonData || typeof jsonData !== 'object') return;
        
        // 递归遍历JSON对象，查找案件URL
        const traverse = (obj) => {
            if (typeof obj === 'string') {
                if (this.isCaseDetailUrl(obj)) {
                    urls.push(this.makeAbsoluteUrl(obj));
                }
            } else if (Array.isArray(obj)) {
                obj.forEach(item => traverse(item));
            } else if (typeof obj === 'object') {
                Object.values(obj).forEach(value => traverse(value));
            }
        };
        
        traverse(jsonData);
    }

    extractUrlsFromScript(scriptContent) {
        const urls = [];
        
        // 查找案件详情页的URL模式
        const urlPatterns = [
            /\/poster\/(NCMC|AMBER)\/\d+\/\d+/g,
            /NCMC\d+/g,
            /AMBER\d+/g,
            /https?:\/\/[^"']*\/poster\/[^"']*/g
        ];
        
        urlPatterns.forEach(pattern => {
            const matches = scriptContent.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    if (this.isCaseDetailUrl(match)) {
                        const fullUrl = this.makeAbsoluteUrl(match);
                        urls.push(fullUrl);
                    }
                });
            }
        });
        
        return urls;
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

    saveUrls(urls) {
        // 过滤和去重
        const filteredUrls = urls.filter(url => 
            url && 
            !url.includes('gethelpnow') && 
            !url.includes('blog') && 
            !url.includes('facebook') &&
            !url.includes('give.missingkids.org') &&
            !url.includes('classy.org') &&
            this.isCaseDetailUrl(url)
        );
        
        const uniqueUrls = [...new Set(filteredUrls)];
        
        // 保存文本格式
        const content = uniqueUrls.join('\n');
        fs.writeFileSync(this.outputFile, content);
        
        // 保存JSON格式
        const jsonContent = {
            timestamp: new Date().toISOString(),
            totalUrls: uniqueUrls.length,
            urls: uniqueUrls
        };
        fs.writeFileSync(
            this.outputFile.replace('.txt', '.json'),
            JSON.stringify(jsonContent, null, 2)
        );
        
        // 保存进度
        const progress = {
            lastRun: new Date().toISOString(),
            totalUrlsFound: uniqueUrls.length,
            urls: uniqueUrls
        };
        fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
    }
}

// 运行
async function main() {
    const extractor = new SmartCaseUrlExtractor();
    await extractor.extract();
}

if (require.main === module) {
    main();
}