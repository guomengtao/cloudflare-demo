const fs = require('fs');
const path = require('path');

// 目标目录
const baseDir = path.join(__dirname, 'big-test');

// 检查基础目录是否存在
if (!fs.existsSync(baseDir)) {
    console.error(`错误: 基础目录 ${baseDir} 不存在，请先运行 generate-folders.js`);
    process.exit(1);
}

// 生成HTML文件内容模板
function generateHtmlContent(folderNum, fileNum) {
    const folderNumStr = folderNum.toString().padStart(2, '0');
    const fileNumStr = fileNum.toString().padStart(3, '0');
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileNumStr}.html - 目录${folderNumStr}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #333;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 600px;
            width: 90%;
            backdrop-filter: blur(10px);
        }
        
        .header {
            margin-bottom: 30px;
        }
        
        .title {
            font-size: 2.5em;
            color: #4a5568;
            margin-bottom: 10px;
            font-weight: 300;
        }
        
        .subtitle {
            font-size: 1.2em;
            color: #718096;
            margin-bottom: 20px;
        }
        
        .content {
            background: linear-gradient(45deg, #f7fafc, #edf2f7);
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
        }
        
        .welcome-text {
            font-size: 1.4em;
            color: #2d3748;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        
        .file-info {
            background: #e2e8f0;
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
        }
        
        .info-item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 1.1em;
        }
        
        .info-label {
            font-weight: 600;
            color: #4a5568;
        }
        
        .info-value {
            color: #2d3748;
        }
        
        .home-button {
            background: linear-gradient(45deg, #48bb78, #38a169);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 1.1em;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
        }
        
        .home-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(72, 187, 120, 0.4);
            background: linear-gradient(45deg, #38a169, #2f855a);
        }
        
        .footer {
            margin-top: 20px;
            color: #718096;
            font-size: 0.9em;
        }
        
        .animation {
            animation: fadeInUp 0.8s ease-out;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .badge {
            background: #ed8936;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            display: inline-block;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container animation">
        <div class="header">
            <h1 class="title">${fileNumStr}.html</h1>
            <div class="subtitle">专业文件展示页面</div>
            <div class="badge">目录 ${folderNumStr}</div>
        </div>
        
        <div class="content">
            <p class="welcome-text">欢迎访问 ${fileNumStr}.html 文件</p>
            <p class="welcome-text">当前的目录是 ${folderNumStr} 目录</p>
            
            <div class="file-info">
                <div class="info-item">
                    <span class="info-label">文件编号:</span>
                    <span class="info-value">${fileNumStr}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">目录编号:</span>
                    <span class="info-value">${folderNumStr}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">创建时间:</span>
                    <span class="info-value">${new Date().toLocaleString('zh-CN')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">文件类型:</span>
                    <span class="info-value">HTML 文档</span>
                </div>
            </div>
            
            <p style="margin-top: 20px; color: #4a5568; font-style: italic;">
                "这里的${fileNumStr} 和${folderNumStr} 是对应的数值，体现了完美的文件组织架构"
            </p>
        </div>
        
        <a href="../../index.html" class="home-button">🏠 返回首页</a>
        
        <div class="footer">
            <p>© 2024 专业文件管理系统 | 第 ${fileNum} 页，共 500 页</p>
        </div>
    </div>
    
    <script>
        // 添加简单的交互效果
        document.addEventListener('DOMContentLoaded', function() {
            const button = document.querySelector('.home-button');
            button.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.05)';
            });
            button.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });
            
            // 页面加载动画
            const elements = document.querySelectorAll('.animation');
            elements.forEach((el, index) => {
                el.style.animationDelay = (index * 0.1) + 's';
            });
        });
    </script>
</body>
</html>`;
}

// 主函数：生成HTML文件
async function generateHtmlFiles() {
    console.log('开始生成HTML文件...\n');
    
    let totalFilesCreated = 0;
    const startTime = Date.now();
    
    // 遍历30个文件夹
    for (let folderNum = 1; folderNum <= 30; folderNum++) {
        const folderName = folderNum.toString().padStart(2, '0');
        const folderPath = path.join(baseDir, folderName);
        
        console.log(`正在处理目录 ${folderName}...`);
        
        // 检查文件夹是否存在
        if (!fs.existsSync(folderPath)) {
            console.log(`  ⚠ 目录 ${folderName} 不存在，跳过`);
            continue;
        }
        
        let filesInFolder = 0;
        
        // 在每个文件夹中生成500个HTML文件
        for (let fileNum = 1; fileNum <= 500; fileNum++) {
            const fileName = fileNum.toString().padStart(3, '0') + '.html';
            const filePath = path.join(folderPath, fileName);
            
            // 生成HTML内容
            const htmlContent = generateHtmlContent(folderNum, fileNum);
            
            // 写入文件
            fs.writeFileSync(filePath, htmlContent, 'utf8');
            filesInFolder++;
            totalFilesCreated++;
            
            // 每生成100个文件显示一次进度
            if (fileNum % 100 === 0) {
                console.log(`  ✓ 已生成 ${fileNum}/500 个文件`);
            }
        }
        
        console.log(`  ✅ 目录 ${folderName} 完成: ${filesInFolder} 个文件`);
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 HTML文件生成完成!');
    console.log('='.repeat(50));
    console.log(`📁 总文件夹数: 30`);
    console.log(`📄 总文件数: ${totalFilesCreated}`);
    console.log(`⏱ 耗时: ${duration} 秒`);
    console.log(`📍 文件位置: ${baseDir}`);
    console.log('='.repeat(50));
    
    if (totalFilesCreated === 15000) {
        console.log('✅ 成功生成全部 15000 个HTML文件!');
    } else {
        console.log(`⚠ 实际生成 ${totalFilesCreated} 个文件，预期 15000 个`);
    }
}

// 运行生成程序
generateHtmlFiles().catch(console.error);