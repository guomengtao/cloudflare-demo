const fs = require('fs');

// 读取并解析JSON文件
const rawData = fs.readFileSync('/Users/Banner/Documents/tom/ai-model-cf.html', 'utf8');
const data = JSON.parse(rawData);

console.log('=== AI模型统计分析（中文） ===\n');

// 1. 统计模型总数
const totalModels = data.result.length;
console.log(`1. 模型总数: ${totalModels}\n`);

// 2. 按类型分类统计
const taskCategories = {};
data.result.forEach(model => {
    const taskName = model.task.name;
    taskCategories[taskName] = (taskCategories[taskName] || 0) + 1;
});

console.log('2. 类型分类统计:');
Object.entries(taskCategories)
    .sort(([a, countA], [b, countB]) => countB - countA)
    .forEach(([task, count]) => {
        console.log(`${task}: ${count}个模型`);
    });

// 3. 获取全部模型（按名称排序）
const allModels = data.result.sort((a, b) => a.name.localeCompare(b.name));

// 4. 生成HTML报告
const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI模型统计分析报告</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
        }
        .stats {
            margin: 20px 0;
            padding: 20px;
            background-color: #e8f4f8;
            border-radius: 5px;
        }
        h2 {
            color: #4CAF50;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
            margin-top: 30px;
        }
        h3 {
            color: #555;
            margin-top: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 14px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
            word-wrap: break-word;
        }
        th {
            background-color: #4CAF50;
            color: white;
            position: sticky;
            top: 0;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .category {
            margin: 10px 0;
            font-weight: bold;
            color: #333;
        }
        .model-name {
            cursor: pointer;
            color: #0066cc;
            text-decoration: underline;
            user-select: none;
        }
        .model-name:hover {
            color: #004499;
        }
        .copy-hint {
            color: #666;
            font-size: 12px;
            margin-left: 10px;
        }
        .usage-scenario {
            font-size: 13px;
            color: #555;
            margin-top: 5px;
        }
        .tooltip {
            position: relative;
            display: inline-block;
        }
        .tooltip .tooltiptext {
            visibility: hidden;
            width: 120px;
            background-color: #555;
            color: #fff;
            text-align: center;
            border-radius: 6px;
            padding: 5px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            margin-left: -60px;
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 12px;
        }
        .tooltip:hover .tooltiptext {
            visibility: visible;
            opacity: 1;
        }
        .success-message {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #4CAF50;
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .success-message.show {
            opacity: 1;
        }
        .table-container {
            overflow-x: auto;
            max-height: 600px;
            overflow-y: auto;
            border: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>AI模型统计分析报告</h1>
        
        <div class="stats">
            <h2>基本统计</h2>
            <p><strong>模型总数:</strong> ${totalModels}</p>
            <h3>类型分类</h3>
            <div>
                ${Object.entries(taskCategories)
                    .sort(([a, countA], [b, countB]) => countB - countA)
                    .map(([task, count]) => `<div class="category">${task}: ${count}个模型</div>`)
                    .join('')}
            </div>
        </div>
        
        <h2>所有模型列表（按名称排序）</h2>
        <p><strong>说明：</strong>点击模型名称可自动复制运行命令（格式：node jack/orm-run-html.js 模型名）</p>
        
        <div class="table-container">
            <table>
                <tr>
                    <th>序号</th>
                    <th>模型名称</th>
                    <th>类型</th>
                    <th>价格</th>
                    <th>使用场景</th>
                    <th>创建日期</th>
                </tr>
                ${allModels.map((model, index) => {
                    const priceProp = model.properties.find(p => p.property_id === 'price');
                    const price = priceProp ? 
                        `${priceProp.value[0]?.price || 'N/A'} ${priceProp.value[0]?.unit || ''}`.trim() : 
                        'N/A';
                    
                    // 简单的使用场景描述
                    let usageScenario = '';
                    switch (model.task.name) {
                        case 'Text Generation':
                            usageScenario = '文本生成、对话系统、内容创作、代码生成等';
                            break;
                        case 'Text Embeddings':
                            usageScenario = '文本向量化、语义搜索、相似度计算、RAG系统';
                            break;
                        case 'Text-to-Speech':
                            usageScenario = '语音合成、有声读物、语音助手、无障碍应用';
                            break;
                        case 'Automatic Speech Recognition':
                            usageScenario = '语音识别、语音转文字、会议记录、字幕生成';
                            break;
                        case 'Image-to-Text':
                            usageScenario = '图像描述、OCR识别、图像内容分析';
                            break;
                        case 'Text Classification':
                            usageScenario = '情感分析、内容分类、垃圾邮件检测';
                            break;
                        case 'Code Generation':
                            usageScenario = '代码生成、代码补全、编程助手';
                            break;
                        case 'Dumb Pipe':
                            usageScenario = '内部模型，用于特定管道处理';
                            break;
                        case 'Object Detection':
                            usageScenario = '目标检测、图像识别、视频分析';
                            break;
                        case 'Text-to-Image':
                            usageScenario = '文本生成图像、创意设计、艺术创作';
                            break;
                        case 'Audio-to-Text':
                            usageScenario = '音频转文字、语音识别、音频内容分析';
                            break;
                        case 'Image Classification':
                            usageScenario = '图像分类、物体识别、场景识别';
                            break;
                        default:
                            usageScenario = '通用场景';
                    }
                    
                    return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>
                            <span class="model-name tooltip" onclick="copyModelCommand('${model.name}')">
                                ${model.name}
                                <span class="tooltiptext">点击复制命令</span>
                            </span>
                            <span class="copy-hint">(点击复制命令)</span>
                        </td>
                        <td>${model.task.name}</td>
                        <td>${price}</td>
                        <td>
                            ${model.description.substring(0, 100)}...
                            <div class="usage-scenario">使用场景：${usageScenario}</div>
                        </td>
                        <td>${model.created_at}</td>
                    </tr>
                    `;
                }).join('')}
            </table>
        </div>
    </div>
    
    <div id="successMessage" class="success-message">命令已复制到剪贴板！</div>
    
    <script>
         function copyModelCommand(modelName) {
             // 构建要复制的命令
             const command = 'node jack/orm-run-html.js ' + modelName;
             
             // 复制到剪贴板
             navigator.clipboard.writeText(command).then(function() {
                 // 显示成功消息
                 const successMessage = document.getElementById('successMessage');
                 successMessage.classList.add('show');
                 
                 // 2秒后隐藏消息
                 setTimeout(function() {
                     successMessage.classList.remove('show');
                 }, 2000);
             }).catch(function(err) {
                 console.error('复制失败:', err);
                 alert('复制失败，请手动复制命令');
             });
         }
     </script>
</body>
</html>
`;

// 保存HTML报告
fs.writeFileSync('/Users/Banner/Documents/tom/ai-models-report.html', htmlContent);
console.log('\n=== 分析完成 ===');
console.log('HTML报告已生成: /Users/Banner/Documents/tom/ai-models-report.html');