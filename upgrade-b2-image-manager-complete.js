// Backblaze B2 图片管理系统 - 完整升级版本
// 支持数据库连接、图片下载、WebP转换和B2上传

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const https = require('https'); // 确保已安装 node-fetch@2
const sharp = require('sharp'); // 用于图片转换
const { execSync } = require('child_process');

// 初始化配置
dotenv.config({ override: true });

// B2 配置
const B2_CONFIG = {
    bucketName: process.env.B2_BUCKET_NAME,
    endpoint: process.env.B2_ENDPOINT,
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    region: process.env.B2_REGION
};

// 验证B2配置是否完整
if (!B2_CONFIG.bucketName || !B2_CONFIG.endpoint || !B2_CONFIG.accessKeyId || !B2_CONFIG.secretAccessKey || !B2_CONFIG.region) {
    console.error('❌ B2配置不完整，请检查.env文件中的B2配置项');
    process.exit(1);
}

// 初始化 AWS S3 客户端
const s3 = new AWS.S3({
    accessKeyId: B2_CONFIG.accessKeyId,
    secretAccessKey: B2_CONFIG.secretAccessKey,
    endpoint: B2_CONFIG.endpoint,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    region: B2_CONFIG.region
});

/**
 * 封装延迟函数
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 创建下载目录
 */
function createDownloadDir(state, county, city, caseId) {
    const dirPath = path.join(__dirname, 'img', state, county, city, caseId);
    
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 创建目录成功: ${dirPath}`);
    }
    
    return dirPath;
}

/**
 * 下载图片（添加重试机制）
 */
async function downloadImage(url, savePath, maxRetries = 3, retryDelay = 2000) {
    const urlObj = new URL(url);
    const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    };

    for (let retry = 0; retry <= maxRetries; retry++) {
        console.log(`📥 正在下载图片: ${url}`);
        
        try {
            // 使用Promise封装http请求
            await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = [];
                    
                    res.on('data', (chunk) => {
                        data.push(chunk);
                    });
                    
                    res.on('end', () => {
                        try {
                            const buffer = Buffer.concat(data);
                            fs.writeFileSync(savePath, buffer);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });
                });
                
                // 设置超时
                req.setTimeout(30000, () => {
                    req.destroy();
                    reject(new Error('请求超时'));
                });
                
                // 处理错误
                req.on('error', (error) => {
                    reject(error);
                });
                
                // 发送请求
                req.end();
            });
            
            console.log(`✅ 图片下载成功: ${savePath}`);
            return true;
        } catch (error) {
            if (retry < maxRetries) {
                console.log(`⚠️  下载失败: ${error.message}，将在 ${retryDelay / 1000} 秒后重试 (${retry + 1}/${maxRetries})`);
                await sleep(retryDelay * (retry + 1));
            } else {
                console.error(`❌ 图片下载失败（已重试${maxRetries}次）: ${error.message}`);
                return false;
            }
        }
    }
    return false;
}

/**
 * 转换图片为WebP格式
 */
async function convertToWebP(inputPath, outputPath) {
    console.log(`🎨 正在转换为WebP格式: ${inputPath}`);
    
    try {
        await sharp(inputPath)
            .webp({ quality: 85 })
            .toFile(outputPath);
        
        console.log(`✅ WebP转换成功: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`❌ WebP转换失败: ${error.message}`);
        return false;
    }
}

/**
 * 上传图片到B2
 */
async function uploadToB2(filePath, caseId, imageType = 'profile') {
    console.log(`📤 正在上传到B2: ${filePath}`);
    
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        const fileExt = path.extname(fileName).toLowerCase();
        
        // 生成存储路径
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const storagePath = `cases/${caseId}/${imageType}-${timestamp}-${randomStr}${fileExt}`;
        
        // 上传参数
        const params = {
            Bucket: B2_CONFIG.bucketName,
            Key: storagePath,
            Body: fileBuffer,
            ContentType: getContentType(fileExt),
            Metadata: {
                'case-id': caseId,
                'image-type': imageType,
                'upload-date': new Date().toISOString(),
                'original-filename': fileName
            }
        };
        
        const result = await s3.upload(params).promise();
        console.log(`✅ 上传成功: ${result.Location}`);
        return result.Location;
    } catch (error) {
        console.error(`❌ 上传失败: ${error.message}`);
        console.error('错误详情:', error.stack);
        return null;
    }
}

/**
 * 获取文件内容类型
 */
function getContentType(ext) {
    const typeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return typeMap[ext] || 'application/octet-stream';
}

/**
 * 执行SQL查询（使用wrangler命令行工具和临时文件）
 */
function queryD1(sql, params = []) {
    try {
        // 替换参数占位符
        let formattedSql = sql;
        params.forEach((param, index) => {
            const placeholder = `?${index + 1}`;
            const escapedParam = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : param;
            formattedSql = formattedSql.replace(placeholder, escapedParam);
        });

        // 创建临时文件
        const tempFileName = `temp_query_${Date.now()}.sql`;
        fs.writeFileSync(tempFileName, formattedSql);
        
        // 使用wrangler命令执行SQL查询，通过文件执行
        const databaseName = 'cloudflare-demo-db';
        const cmd = `npx wrangler d1 execute ${databaseName} --remote --json --file="${tempFileName}"`;
        
        console.log('💡 执行SQL查询:', formattedSql);
        console.log('💻 执行命令:', cmd);
        
        // 执行命令并获取输出
        const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
        
        // 解析输出
        const parsedResult = JSON.parse(output);
        console.log('✅ SQL查询执行成功');
        
        // 删除临时文件
        fs.unlinkSync(tempFileName);
        
        return parsedResult;
    } catch (error) {
        console.error('❌ SQL查询执行失败:', error.message);
        console.error('执行的SQL:', sql);
        console.error('参数:', params);
        if (error.stdout) console.error('标准输出:', error.stdout);
        if (error.stderr) console.error('标准错误:', error.stderr);
        return null;
    }
}

/**
 * 统计符合条件的案件总数
 */
function countCases() {
    console.log('📊 正在统计符合条件的案件总数...');
    
    try {
        // 使用一个非常简单的SQL查询，避免复杂的字段列表
        const sql = "SELECT COUNT(*) as total FROM missing_persons_info WHERE image_webp_status = 0 AND html_status = 200";
        
        // 打印SQL字符串，检查是否包含正确的字段分隔符
        console.log('🔍 原始SQL:', sql);
        
        const result = queryD1(sql);
        
        if (!result || result.length === 0) {
            console.log('📊 无法获取案件总数');
            return 0;
        }
        
        return result[0].total || 0;
        
    } catch (error) {
        console.error('❌ 统计案件总数失败:', error.message);
        return 0;
    }
}

/**
 * 从数据库获取下一个待处理案件
 */
function getNextCase() {
    console.log('🔍 正在查找符合条件的案件...');
    
    try {
        // 使用一个非常简单的SQL查询，只选择必要的字段
        const sql = "SELECT * FROM missing_persons_info WHERE image_webp_status = 0 AND html_status = 200 ORDER BY id LIMIT 1";
        
        // 打印SQL字符串，检查是否包含正确的字段分隔符
        console.log('🔍 原始SQL:', sql);
        
        const result = queryD1(sql);
        
        if (!result || result.length === 0) {
            console.log('🔍 没有更多符合条件的案件');
            return null;
        }
        
        return result[0];
        
    } catch (error) {
        console.error('❌ 获取案件数据失败:', error.message);
        return null;
    }
}

/**
 * 更新案件处理状态
 */
function updateCase(caseId, updateData) {
    console.log(`📝 正在更新案件 ${caseId} 的状态...`);
    
    try {
        // 构建更新SQL
        const updateFields = Object.entries(updateData)
            .map(([key, value]) => `${key} = ?`)
            .join(', ');
        
        const updateValues = Object.values(updateData);
        updateValues.push(caseId);
        
        const sql = `UPDATE missing_persons_info SET ${updateFields} WHERE case_id = ?`;
        const result = queryD1(sql, updateValues);
        
        if (result) {
            console.log(`✅ 案件 ${caseId} 状态更新成功`);
            console.log(`📌 更新的字段: ${JSON.stringify(updateData)}`);
            return true;
        } else {
            console.error('❌ 案件状态更新失败');
            console.error('📌 尝试更新的字段:', JSON.stringify(updateData));
            return false;
        }
        
    } catch (error) {
        console.error('❌ 更新案件状态失败:', error.message);
        console.error('📌 尝试更新的字段:', JSON.stringify(updateData));
        return false;
    }
}

/**
 * 处理单个案件
 */
async function processCase(caseInfo) {
    console.log(`\n🚀 开始处理案件`);
    
    try {
        const { id, case_id, case_url, images_json, missing_state, missing_county, missing_city } = caseInfo;
        
        // 解析图片JSON
        let images;
        try {
            images = typeof images_json === 'string' ? JSON.parse(images_json) : images_json;
            if (!Array.isArray(images)) {
                throw new Error('images_json不是有效的数组');
            }
        } catch (parseError) {
            console.error('❌ 解析图片JSON失败:', parseError.message);
            updateCase(case_id, { image_webp_status: 300 }); // 标记为解析错误
            return { case_id, success: false, error: '图片JSON解析失败' };
        }
        
        // 打印详细的案件信息
        console.log(`📋 案件详细信息:`);
        console.log(`   - 表ID: ${id}`);
        console.log(`   - 案件ID: ${case_id}`);
        console.log(`   - 案件URL: ${case_url || '未提供'}`);
        console.log(`   - 图片数量: ${images.length}`);
        console.log(`   - 案件位置: ${missing_state}/${missing_county}/${missing_city}`);
        console.log(`   - 图片URL列表:`);
        images.forEach((url, index) => {
            console.log(`     [${index + 1}] ${url}`);
        });
        
        // 第一步：更新状态为处理中
        console.log('\n🔄 开始更新案件状态为处理中(100)...');
        const updateSuccess = updateCase(case_id, {
            image_webp_status: 100,
            image_count: images.length
        });
        
        if (updateSuccess) {
            console.log('✅ 案件状态已成功更新为处理中(100)');
        } else {
            console.error('❌ 案件状态更新失败');
        }
        
        // 创建下载目录
        const downloadDir = createDownloadDir(missing_state, missing_county, missing_city, case_id);
        
        // 处理每张图片
        let successCount = 0;
        const uploadedUrls = [];
        
        for (let i = 0; i < images.length; i++) {
            const imageUrl = images[i];
            const imageName = `image-${i}.jpg`;
            const originalPath = path.join(downloadDir, imageName);
            const webpPath = path.join(downloadDir, `image-${i}.webp`);
            
            // 下载图片
             const downloadSuccess = await downloadImage(imageUrl, originalPath);
            if (!downloadSuccess) continue;
            
            // 转换为WebP
             const convertSuccess = await convertToWebP(originalPath, webpPath);
            if (!convertSuccess) {
                fs.unlinkSync(originalPath); // 清理原始图片
                continue;
            }
            
            // 上传到B2
             const uploadUrl = await uploadToB2(webpPath, case_id, 'evidence');
            if (uploadUrl) {
                successCount++;
                uploadedUrls.push(uploadUrl);
            }
            
            // 清理本地文件
            if (fs.existsSync(originalPath)) {
                fs.unlinkSync(originalPath);
            }
            if (fs.existsSync(webpPath)) {
                fs.unlinkSync(webpPath);
            }
        }
        
        // 最后一步：更新状态为完成
        updateCase(case_id, {
            image_webp_status: 200,
            webp_images_json: JSON.stringify(uploadedUrls),
            webp_success_count: successCount
        });
        
        console.log(`✅ 案件处理完成: ${case_id}`);
        console.log(`📊 处理结果: ${successCount}/${images.length} 张图片成功`);
        
        return {
            case_id,
            success: true,
            processed_count: successCount,
            total_count: images.length
        };
        
    } catch (error) {
        console.error(`❌ 案件处理失败: ${error.message}`);
        console.error('错误详情:', error.stack);
        
        // 更新状态为错误
        if (caseInfo.case_id) {
            updateCase(caseInfo.case_id, { image_webp_status: 300 });
        }
        
        return {
            case_id: caseInfo.case_id,
            success: false,
            error: error.message
        };
    }
}

/**
 * 主程序入口
 */
async function main() {
    console.log('🌟 Backblaze B2 图片管理系统 - 完整升级版本');
    console.log('======================================\n');
    
    const TASK_LIMIT = 2; // 每执行2个任务后停止
    let taskCount = 0;
    
    try {
        // 统计符合条件的案件总数
        const totalCases = countCases();
        console.log(`📊 共搜索到 ${totalCases} 个符合条件的案件需要处理图片\n`);
        
        while (taskCount < TASK_LIMIT) {
            // 获取下一个待处理案件
            const caseInfo = getNextCase();
            
            if (!caseInfo) {
                console.log('🔍 没有更多待处理案件');
                break;
            }
            
            // 处理案件
            await processCase(caseInfo);
            taskCount++;
            
            // 如果不是最后一个任务，添加延迟
            if (taskCount < TASK_LIMIT) {
                console.log('\n⏳ 等待 5 秒后执行下一个任务...');
                sleep(5000);
            }
        }
        
        console.log(`\n🏁 处理完成！共处理了 ${taskCount} 个任务`);
        
    } catch (error) {
        console.error(`❌ 程序执行失败: ${error.message}`);
        console.error('错误详情:', error.stack);
        process.exit(1);
    }
}

// 启动程序
main();