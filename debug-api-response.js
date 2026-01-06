const axios = require('axios');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

class ApiDebugger {
    constructor() {
        this.baseUrl = 'https://www.missingkids.org/es/gethelpnow/search/poster-search-results';
        this.apiUrl = 'https://api.missingkids.org/missingkids/servlet/JSONDataServlet';
        this.debugFile = path.join(__dirname, 'api-debug-response.txt');
    }

    async debugApiCalls() {
        console.log('🔍 开始调试API响应...');
        
        try {
            // 方法1: 模拟表单提交
            console.log('\n📝 方法1: 模拟表单提交');
            const formResponse = await this.simulateFormSubmission();
            this.saveDebugData('表单提交响应', formResponse);
            
            // 方法2: 直接API调用
            console.log('\n📝 方法2: 直接API调用');
            const apiResponse = await this.directApiCall();
            this.saveDebugData('直接API调用响应', apiResponse);
            
            console.log(`💾 调试数据已保存: ${this.debugFile}`);
            
        } catch (error) {
            console.error('❌ 调试失败:', error.message);
        }
    }

    async simulateFormSubmission() {
        try {
            // 构建表单数据
            const formData = {
                action: 'publicSearch',
                search: 'new',
                searchLang: 'es_US',
                LanguageId: 'es_US',
                caseType: 'All',
                subjToSearch: 'child',
                orderBy: 'MostRecent',
                firstName: '',
                lastName: '',
                missCity: '',
                missState: 'All',
                missCountry: 'All',
                zip: '',
                page: 1
            };
            
            console.log('📤 发送表单数据:', formData);
            
            const response = await axios.post(this.apiUrl, querystring.stringify(formData), {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.baseUrl,
                    'Origin': 'https://www.missingkids.org'
                }
            });
            
            console.log('✅ 表单提交成功');
            console.log('📊 响应状态:', response.status);
            console.log('📊 响应头:', response.headers);
            
            return {
                status: response.status,
                headers: response.headers,
                data: response.data,
                dataType: typeof response.data,
                dataLength: typeof response.data === 'string' ? response.data.length : 'N/A'
            };
            
        } catch (error) {
            console.log('❌ 表单提交失败:', error.message);
            return { error: error.message };
        }
    }

    async directApiCall() {
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
                page: 1,
                rows: 50
            };
            
            console.log('📤 发送API参数:', params);
            
            const response = await axios.get(this.apiUrl, {
                params: params,
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.baseUrl
                }
            });
            
            console.log('✅ API调用成功');
            console.log('📊 响应状态:', response.status);
            console.log('📊 响应头:', response.headers);
            
            return {
                status: response.status,
                headers: response.headers,
                data: response.data,
                dataType: typeof response.data,
                dataLength: typeof response.data === 'string' ? response.data.length : 'N/A',
                first500Chars: typeof response.data === 'string' ? response.data.substring(0, 500) : 'N/A'
            };
            
        } catch (error) {
            console.log('❌ API调用失败:', error.message);
            return { error: error.message };
        }
    }

    saveDebugData(method, response) {
        const timestamp = new Date().toISOString();
        const debugContent = `
=== ${method} - ${timestamp} ===
状态: ${response.status || 'N/A'}
数据类型: ${response.dataType || 'N/A'}
数据长度: ${response.dataLength || 'N/A'}

响应头:
${JSON.stringify(response.headers, null, 2)}

响应数据前500字符:
${response.first500Chars || 'N/A'}

完整响应数据:
${typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data}

错误信息:
${response.error || '无错误'}
=== 结束 ===

`;

        fs.appendFileSync(this.debugFile, debugContent);
        
        // 同时在控制台显示关键信息
        console.log('📋 响应数据预览:');
        if (response.first500Chars && response.first500Chars !== 'N/A') {
            console.log(response.first500Chars);
        }
        
        // 尝试解析JSON数据
        if (response.data && typeof response.data === 'string') {
            try {
                const jsonData = JSON.parse(response.data);
                console.log('✅ JSON解析成功');
                console.log('📊 JSON结构:', Object.keys(jsonData));
                if (jsonData.rows) {
                    console.log(`📊 找到 ${jsonData.rows.length} 行数据`);
                }
                if (jsonData.cases) {
                    console.log(`📊 找到 ${jsonData.cases.length} 个案件`);
                }
            } catch (e) {
                console.log('⚠️ JSON解析失败，可能是其他格式');
            }
        }
    }
}

// 运行
async function main() {
    const apiDebugger = new ApiDebugger();
    await apiDebugger.debugApiCalls();
}

if (require.main === module) {
    main();
}