const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// 初始化配置
const envPath = fs.existsSync(path.resolve(__dirname, '.env')) 
    ? path.resolve(__dirname, '.env') 
    : path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

// 封装 D1 API 调用
async function queryD1(sql, params = []) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params })
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(`D1 API 错误: ${JSON.stringify(data.errors)}`);
    }
    console.log('API 响应:', JSON.stringify(data, null, 2));
    return data.result[0];
}

// 检查数据库表结构
async function checkDatabase() {
    try {
        // 查询所有表
        console.log('查询数据库中的所有表...');
        const tablesResult = await queryD1("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('tablesResult:', tablesResult);
        if (tablesResult && tablesResult.rows) {
            console.log('数据库表:', tablesResult.rows.map(row => row.name));
        }
        
        // 查询missing_persons_cases表结构
        console.log('\n查询missing_persons_cases表结构...');
        const tableInfoResult = await queryD1("PRAGMA table_info(missing_persons_cases)");
        console.log('tableInfoResult:', tableInfoResult);
        if (tableInfoResult && tableInfoResult.rows) {
            console.log('表结构:', tableInfoResult.rows);
        }
        
        // 查询一些示例数据
        console.log('\n查询missing_persons_cases表中的前5条数据...');
        const sampleDataResult = await queryD1("SELECT * FROM missing_persons_cases LIMIT 5");
        console.log('sampleDataResult:', sampleDataResult);
        if (sampleDataResult && sampleDataResult.rows) {
            console.log('示例数据:', sampleDataResult.rows);
        }
        
    } catch (error) {
        console.error('检查数据库时出错:', error);
    }
}

// 运行检查
checkDatabase();