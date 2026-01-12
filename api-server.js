const express = require('express');
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

const app = express();
const PORT = process.env.PORT || 3000;

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
    return data.result[0];
}

// API 端点：获取案件详情
app.get('/api/case/:caseId', async (req, res) => {
    const caseId = req.params.caseId;
    
    try {
        // 从数据库中查询案件
        const result = await queryD1(
            'SELECT case_html FROM missing_persons_cases WHERE case_id = ?',
            [caseId]
        );
        
        if (result.rows && result.rows.length > 0) {
            res.json({
                case_id: caseId,
                case_html: result.rows[0].case_html
            });
        } else {
            res.status(404).json({ error: 'Case not found' });
        }
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 静态文件服务
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`访问 http://localhost:${PORT}/case.html 查看案例页面`);
    console.log(`API 端点: http://localhost:${PORT}/api/case/:caseId`);
});