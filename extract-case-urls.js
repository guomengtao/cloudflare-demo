const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

class CaseUrlExtractor {
    constructor() {
        this.baseUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.maxPages = 10;
        this.requestDelay = 2000;
        this.timeout = 30000;
        this.outputDir = path.join(__dirname, 'case-urls');
        
        if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 方法1: 直接提交空表单获取所有结果
    async submitSearchForm() {
        try {
            console.log('🔍 正在提交搜索表单获取案件列表...');
            
            const formData = {
                'action': 'publicSearch',
                'search': 'new',
                'searchLang': 'es_US',
                'LanguageId': 'es_US',
                'caseType': 'All',
                'zip': '',
                'firstName': '',
                'lastName': '',
                'orderBy': 'MostRecent',
                'subjToSearch': 'child',
                'missCity': '',
                'missState': 'All',
                'missCountry': 'All',
                'missYear': '',
                'missMonth': '',
                'missDay': '',
                'foundYear': '',
                'foundMonth': '',
                'foundDay': ''
            };

            const response = await axios.post(this.baseUrl, querystring.stringify(formData), {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'Origin': 'https://www.missingkids.org',
                    'Referer': this.baseUrl
                }
            });

            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const $ = cheerio.load(response.data);
            
            // 保存响应内容用于调试
            fs.writeFileSync(path.join(this.outputDir, 'form-submission-response.html'), response.data);
            
            return this.extractCaseUrls($, 1);
            
        } catch (error) {
            console.error('❌ 表单提交失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 方法2: 分析页面结构，查找可能的案件链接模式
    async analyzePageStructure() {
        try {
            console.log('📊 正在分析页面结构...');
            
            const response = await axios.get(this.baseUrl, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            // 查找所有可能的案件链接模式
            const linkPatterns = this.findLinkPatterns($);
            
            // 查找JavaScript数据
            const jsData = this.extractJavaScriptData($);
            
            // 查找隐藏的表单数据
            const hiddenData = this.extractHiddenData($);
            
            return {
                linkPatterns,
                jsData,
                hiddenData,
                html: response.data
            };
            
        } catch (error) {
            console.error('❌ 页面分析失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 查找链接模式
    findLinkPatterns($) {
        const patterns = [];
        
        // 查找所有链接
        $('a[href]').each((i, element) => {
            const href = $(element).attr('href');
            const text = $(element).text().trim();
            
            // 检查是否可能是案件链接
            if (this.isPotentialCaseLink(href, text)) {
                patterns.push({
                    href: href,
                    text: text,
                    fullUrl: href.startsWith('http') ? href : `https://www.missingkids.org${href}`,
                    context: $(element).parent().text().substring(0, 100)
                });
            }
        });
        
        return patterns;
    }

    // 判断是否可能是案件链接
    isPotentialCaseLink(href, text) {
        const caseIndicators = [
            'NCMC', 'AMBER', 'caso', 'case', 'missing', 'desaparecido',
            'poster', 'cartel', 'child', 'niño', 'profile', 'perfil'
        ];
        
        const hrefLower = href.toLowerCase();
        const textLower = text.toLowerCase();
        
        // 检查链接是否包含案件相关关键词
        const hasCaseKeyword = caseIndicators.some(keyword => 
            hrefLower.includes(keyword.toLowerCase()) || 
            textLower.includes(keyword.toLowerCase())
        );
        
        // 检查是否是相对路径或绝对路径
        const isRelativePath = href.startsWith('/') && !href.startsWith('//');
        const isAbsolutePath = href.startsWith('http') && href.includes('missingkids.org');
        
        return hasCaseKeyword && (isRelativePath || isAbsolutePath);
    }

    // 提取JavaScript中的数据
    extractJavaScriptData($) {
        const jsData = [];
        
        $('script').each((i, element) => {
            const scriptContent = $(element).html();
            if (scriptContent) {
                // 查找包含案件数据的JavaScript变量
                const caseMatches = scriptContent.match(/(NCMC\d+|AMBER\d+)/g);
                if (caseMatches) {
                    jsData.push({
                        scriptIndex: i,
                        caseNumbers: [...new Set(caseMatches)],
                        snippet: scriptContent.substring(0, 200)
                    });
                }
                
                // 查找包含URL的JavaScript
                const urlMatches = scriptContent.match(/https?:\/\/[^"']*missingkids[^"']*/g);
                if (urlMatches) {
                    jsData.push({
                        scriptIndex: i,
                        urls: urlMatches,
                        snippet: scriptContent.substring(0, 200)
                    });
                }
            }
        });
        
        return jsData;
    }

    // 提取隐藏的表单数据
    extractHiddenData($) {
        const hiddenData = [];
        
        $('input[type="hidden"]').each((i, element) => {
            const name = $(element).attr('name');
            const value = $(element).attr('value');
            
            if (name && value) {
                hiddenData.push({
                    name: name,
                    value: value,
                    potentialUse: this.assessHiddenField(name, value)
                });
            }
        });
        
        return hiddenData;
    }

    // 评估隐藏字段的用途
    assessHiddenField(name, value) {
        if (name.includes('case') || name.includes('id')) {
            return '可能包含案件ID';
        }
        if (value.includes('NCMC') || value.includes('AMBER')) {
            return '包含案件编号';
        }
        if (name.includes('page') || name.includes('offset')) {
            return '分页参数';
        }
        return '未知';
    }

    // 方法3: 尝试直接访问已知的案件URL模式
    async tryKnownPatterns() {
        console.log('🔎 尝试已知的案件URL模式...');
        
        const knownPatterns = [
            '/es/NCMC/search/viewcase',
            '/es/AMBER/search/viewcase',
            '/gethelpnow/search/viewcase',
            '/poster/NCMC',
            '/poster/AMBER',
            '/case/NCMC',
            '/case/AMBER'
        ];
        
        const caseUrls = [];
        
        // 这里可以添加逻辑来生成可能的案件URL
        // 例如基于已知的案件编号范围
        
        return caseUrls;
    }

    // 提取案件URL
    extractCaseUrls($, pageNumber) {
        const caseUrls = [];
        
        console.log(`📄 正在提取第 ${pageNumber} 页的案件URL...`);
        
        // 方法1: 查找包含案件编号的链接
        $('a[href*="NCMC"], a[href*="AMBER"]').each((i, element) => {
            const href = $(element).attr('href');
            const text = $(element).text().trim();
            
            if (href && (href.includes('NCMC') || href.includes('AMBER'))) {
                const fullUrl = href.startsWith('http') ? href : `https://www.missingkids.org${href}`;
                
                caseUrls.push({
                    url: fullUrl,
                    caseNumber: this.extractCaseNumber(href) || this.extractCaseNumber(text),
                    page: pageNumber,
                    linkText: text.substring(0, 50)
                });
            }
        });
        
        // 方法2: 查找可能包含案件信息的div或section
        $('[class*="case"], [class*="poster"], [class*="result"]').each((i, element) => {
            const $element = $(element);
            const text = $element.text();
            
            // 在元素文本中查找案件编号
            const caseNumber = this.extractCaseNumber(text);
            if (caseNumber) {
                // 在元素内查找链接
                $element.find('a[href]').each((j, link) => {
                    const href = $(link).attr('href');
                    if (href && !href.includes('#')) {
                        const fullUrl = href.startsWith('http') ? href : `https://www.missingkids.org${href}`;
                        
                        caseUrls.push({
                            url: fullUrl,
                            caseNumber: caseNumber,
                            page: pageNumber,
                            linkText: $(link).text().trim().substring(0, 50),
                            source: 'element-analysis'
                        });
                    }
                });
            }
        });
        
        // 去重
        const uniqueUrls = this.removeDuplicates(caseUrls);
        
        console.log(`✅ 第 ${pageNumber} 页找到 ${uniqueUrls.length} 个案件URL`);
        
        return {
            success: true,
            urls: uniqueUrls,
            page: pageNumber
        };
    }

    // 提取案件编号
    extractCaseNumber(text) {
        const ncmcMatch = text.match(/NCMC\s*(\d+)/i);
        const amberMatch = text.match(/AMBER\s*(\d+)/i);
        
        if (ncmcMatch) return `NCMC${ncmcMatch[1]}`;
        if (amberMatch) return `AMBER${amberMatch[1]}`;
        return null;
    }

    // 去重
    removeDuplicates(urls) {
        const seen = new Set();
        return urls.filter(item => {
            const key = item.url;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // 保存结果
    saveResults(urls, method) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `case-urls-${method}-${timestamp}.json`;
        const filepath = path.join(this.outputDir, filename);
        
        const results = {
            timestamp: new Date().toISOString(),
            method: method,
            totalUrls: urls.length,
            urls: urls
        };
        
        fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
        console.log(`💾 结果已保存: ${filepath}`);
        
        // 同时保存为简单的文本文件
        const txtFilepath = path.join(this.outputDir, `case-urls-${method}-${timestamp}.txt`);
        const urlList = urls.map(item => item.url).join('\n');
        fs.writeFileSync(txtFilepath, urlList);
        console.log(`📝 URL列表已保存: ${txtFilepath}`);
    }

    // 主提取方法
    async extract() {
        console.log('🚀 开始提取missingkids.org案件内页地址...');
        console.log('📝 方法: 多策略URL提取');
        
        let allUrls = [];
        
        // 方法1: 分析页面结构
        console.log('\n--- 方法1: 页面结构分析 ---');
        const analysis = await this.analyzePageStructure();
        
        if (analysis.success) {
            console.log(`🔗 找到 ${analysis.linkPatterns.length} 个潜在链接模式`);
            console.log(`📜 找到 ${analysis.jsData.length} 个JavaScript数据片段`);
            console.log(`📋 找到 ${analysis.hiddenData.length} 个隐藏字段`);
            
            // 保存分析结果
            fs.writeFileSync(
                path.join(this.outputDir, 'page-analysis.json'), 
                JSON.stringify(analysis, null, 2)
            );
            
            // 将找到的链接模式添加到结果中
            analysis.linkPatterns.forEach(pattern => {
                allUrls.push({
                    url: pattern.fullUrl,
                    caseNumber: this.extractCaseNumber(pattern.href) || this.extractCaseNumber(pattern.text),
                    page: 1,
                    linkText: pattern.text,
                    source: 'pattern-analysis'
                });
            });
        }
        
        // 方法2: 提交表单获取结果
        console.log('\n--- 方法2: 表单提交 ---');
        await this.delay(1000);
        
        const formResult = await this.submitSearchForm();
        if (formResult.success) {
            allUrls = [...allUrls, ...formResult.urls];
        }
        
        // 方法3: 尝试已知模式
        console.log('\n--- 方法3: 已知模式尝试 ---');
        await this.delay(1000);
        
        const patternUrls = await this.tryKnownPatterns();
        allUrls = [...allUrls, ...patternUrls];
        
        // 去重并保存结果
        const uniqueUrls = this.removeDuplicates(allUrls);
        
        console.log(`\n🎉 提取完成! 总共找到 ${uniqueUrls.length} 个唯一案件URL`);
        
        // 保存结果
        this.saveResults(uniqueUrls, 'combined');
        
        // 显示前10个URL作为示例
        if (uniqueUrls.length > 0) {
            console.log('\n📋 前10个案件URL:');
            uniqueUrls.slice(0, 10).forEach((url, index) => {
                console.log(`${index + 1}. ${url.url} (${url.caseNumber || '未知'})`);
            });
        }
        
        return uniqueUrls;
    }
}

// 运行提取
async function main() {
    const extractor = new CaseUrlExtractor();
    
    try {
        await extractor.extract();
    } catch (error) {
        console.error('❌ 提取过程出错:', error);
    }
}

// 直接运行或导出
if (require.main === module) {
    main();
}

module.exports = CaseUrlExtractor;