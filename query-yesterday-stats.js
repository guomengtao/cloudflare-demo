#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// 初始化配置
const envPath = fs.existsSync(path.resolve(__dirname, '.env')) 
    ? path.resolve(__dirname, '.env') 
    : null;
if (envPath) {
    dotenv.config({ path: envPath });
}

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;

// 确保环境变量存在
if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_DATABASE_ID) {
    console.error('❌ 缺少必要的环境变量');
    console.error('需要设置: CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID');
    process.exit(1);
}

// API 配置
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

/**
 * 封装 D1 API 调用
 */
async function queryD1(sql, params = []) {
    console.log(`📊 执行 SQL 查询: ${sql}`);
    console.log(`📋 参数: ${JSON.stringify(params)}`);
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params })
    });

    const data = await response.json();
    
    console.log(`📥 API 响应状态: ${response.status}`);
    console.log(`📦 响应数据: ${JSON.stringify(data, null, 2)}`);
    
    if (!data.success) {
        throw new Error(`D1 API 错误: ${JSON.stringify(data.errors)}`);
    }
    
    return data.result[0];
}

/**
 * 获取昨天的日期范围
 */
function getYesterdayDateRange() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 设置昨天的开始时间 (00:00:00)
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    
    // 设置昨天的结束时间 (23:59:59)
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    // 格式化为 ISO 字符串，用于 SQL 查询
    return {
        start: yesterdayStart.toISOString(),
        end: yesterdayEnd.toISOString(),
        date: yesterday.toISOString().split('T')[0] // 仅日期部分 (YYYY-MM-DD)
    };
}

/**
 * 查询昨天的统计数据
 */
async function queryYesterdayStats() {
    try {
        console.log('🚀 开始查询昨天的统计数据...');
        
        // 获取昨天的日期范围
        const dateRange = getYesterdayDateRange();
        console.log(`📅 查询日期: ${dateRange.date}`);
        console.log(`🕒 时间范围: ${dateRange.start} 至 ${dateRange.end}`);
        
        // 示例1: 查询昨天新增的案件数量
        console.log('\n1️⃣ 查询昨天新增的案件数量:');
        const newCasesSql = `
            SELECT COUNT(*) as new_cases 
            FROM missing_persons_cases 
            WHERE created_at BETWEEN ? AND ?
        `;
        const newCasesResult = await queryD1(newCasesSql, [dateRange.start, dateRange.end]);
        const newCases = newCasesResult.results[0].new_cases || 0;
        console.log(`✅ 昨天新增案件: ${newCases} 个`);
        
        // 示例2: 查询案件总数统计
        console.log('\n2️⃣ 查询案件总数统计:');
        const totalCasesSql = `
            SELECT COUNT(*) as total_cases 
            FROM missing_persons_cases
        `;
        const totalCasesResult = await queryD1(totalCasesSql);
        const totalCases = totalCasesResult.results[0].total_cases || 0;
        console.log(`✅ 案件总数: ${totalCases} 个`);
        
        // 示例3: 查询失踪人员信息统计
        console.log('\n3️⃣ 查询失踪人员信息统计:');
        const personsSql = `
            SELECT COUNT(*) as total_persons 
            FROM missing_persons_info
        `;
        const personsResult = await queryD1(personsSql);
        const totalPersons = personsResult.results[0].total_persons || 0;
        console.log(`✅ 失踪人员总数: ${totalPersons} 个`);
        
        // 示例4: 查询本地化案件统计
        console.log('\n4️⃣ 查询本地化案件统计:');
        const localizationsSql = `
            SELECT COUNT(*) as total_localizations 
            FROM case_localizations
        `;
        const localizationsResult = await queryD1(localizationsSql);
        const totalLocalizations = localizationsResult.results[0].total_localizations || 0;
        console.log(`✅ 本地化案件总数: ${totalLocalizations} 个`);
        
        // 生成综合统计报告
        const report = {
            date: dateRange.date,
            query_date_range: {
                start: dateRange.start,
                end: dateRange.end
            },
            daily_statistics: {
                new_cases: newCases
            },
            total_statistics: {
                total_cases: totalCases,
                total_persons: totalPersons,
                total_localizations: totalLocalizations
            },
            timestamp: new Date().toISOString()
        };
        
        // 保存报告到文件
        const reportFileName = `stats-report-${dateRange.date}.json`;
        fs.writeFileSync(reportFileName, JSON.stringify(report, null, 2), 'utf8');
        console.log(`\n📄 统计报告已保存到: ${reportFileName}`);
        
        // 输出综合结果
        console.log('\n🎉 统计查询完成!');
        console.log(`📊 综合统计:`);
        console.log(`   日期: ${report.date}`);
        console.log(`   昨天新增案件: ${report.daily_statistics.new_cases}`);
        console.log(`   案件总数: ${report.total_statistics.total_cases}`);
        console.log(`   失踪人员总数: ${report.total_statistics.total_persons}`);
        console.log(`   本地化案件总数: ${report.total_statistics.total_localizations}`);
        
        return report;
        
    } catch (error) {
        console.error('❌ 查询失败:', error.message);
        console.error('📝 详细错误:', error.stack);
        process.exit(1);
    }
}

/**
 * 查询数据库表结构
 */
async function checkDatabaseSchema() {
    try {
        console.log('\n🔍 检查数据库表结构...');
        
        // 查询表列表
        const tablesSql = `SELECT name FROM sqlite_master WHERE type='table'`;
        const tablesResult = await queryD1(tablesSql);
        
        console.log('✅ 数据库表列表:');
        tablesResult.results.forEach(table => {
            console.log(`   - ${table.name}`);
        });
        
        // 如果有 cases 表，查询表结构
        const hasCasesTable = tablesResult.results.some(table => table.name === 'cases');
        if (hasCasesTable) {
            console.log('\n📋 cases 表结构:');
            const schemaSql = `PRAGMA table_info(cases)`;
            const schemaResult = await queryD1(schemaSql);
            
            console.log('   字段名 | 类型 | 非空 | 默认值 | 主键');
            console.log('   ------------------------------------');
            schemaResult.results.forEach(field => {
                console.log(`   ${field.name.padEnd(8)} | ${field.type.padEnd(10)} | ${field.notnull ? '是' : '否'} | ${field.dflt_value || ''} | ${field.pk ? '是' : '否'}`);
            });
        }
        
    } catch (error) {
        console.error('❌ 检查数据库结构失败:', error.message);
    }
}

// 主函数
async function main() {
    console.log('====================================');
    console.log('  Cloudflare D1 昨天统计数据查询工具  ');
    console.log('====================================\n');
    
    // 首先检查数据库结构
    await checkDatabaseSchema();
    
    // 然后查询昨天的统计数据
    await queryYesterdayStats();
    
    console.log('\n====================================');
    console.log('             查询完成                 ');
    console.log('====================================');
}

// 执行主函数
if (require.main === module) {
    main();
}

// 导出函数供其他模块使用
module.exports = {
    queryYesterdayStats,
    checkDatabaseSchema,
    getYesterdayDateRange
};