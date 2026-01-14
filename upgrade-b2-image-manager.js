// Backblaze B2 图片管理系统 - 升级版本
// 支持从数据库读取任务、图片下载、WebP转换和批量上传

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const { execSync } = require('child_process');
const sharp = require('sharp'); // 用于图片转换

// 初始化配置
const envPath = fs.existsSync(path.resolve(__dirname, '.env')) 
    ? path.resolve(__dirname, '.env') 
    : path.resolve(__dirname, '.env');
dotenv.config({ path: envPath, override: true });

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
 * 封装 D1 API 调用 (使用 wrangler 命令)
 */
async function queryD1(sql, params = []) {
    console.log(`📝 执行SQL: ${sql}`);
    if (params.length > 0) {
        console.log(`   参数: ${JSON.stringify(params)}`);
    }
    
    // 替换参数占位符
    let processedSql = sql;
    params.forEach((param, index) => {
        const placeholder = `$${index + 1}`;
        processedSql = processedSql.replace(placeholder, `'${param}'`);
    });
    
    try {
        // 使用 wrangler 命令执行 SQL
        const command = `npx wrangler d1 execute cloudflare-demo-db --remote --json --command="${processedSql}"`;
        const output = execSync(command, { encoding: 'utf8' });
        
        // 解析输出
        const startIndex = output.indexOf('[');
        const endIndex = output.lastIndexOf(']') + 1;
        
        if (startIndex !== -1 && endIndex !== -1) {
            const jsonOutput = output.substring(startIndex, endIndex);
            const result = JSON.parse(jsonOutput);
            return result[0];
        } else {
            throw new Error('无法解析 D1 输出');
        }
    } catch (error) {
        console.error('D1 执行错误:', error.message);
        throw new Error(`D1 API 错误: ${error.message}`);
    }
}

/**
 * 获取符合条件的数据
 */
async function getNextCase() {
    console.log('🔍 正在查找符合条件的数据...');
    
    const selectQuery = `
        SELECT 
            id, case_id, images_json, missing_state, missing_county, missing_city, image_count
        FROM missing_persons_info 
        WHERE image_webp_status = 0 
        AND html_status = 200
        ORDER BY id
        LIMIT 1
    `;
    
    try {
        const result = await queryD1(selectQuery);
        return result?.results?.[0] || null;
    } catch (error) {
        console.error('获取数据失败:', error.message);
        return null;
    }
}

/**
 * 更新数据库记录
 */
async function updateCase(caseId, updates) {
    try {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        
        const updateQuery = `
            UPDATE missing_persons_info 
            SET ${setClause}, updated_at = datetime('now')
            WHERE case_id = ?
        `;
        
        await queryD1(updateQuery, [...values, caseId]);
        console.log(`✅ 更新案件 ${caseId} 成功: ${JSON.stringify(updates)}`);
        return true;
    } catch (error) {
        console.error(`更新案件 ${caseId} 失败: ${error.message}`);
        return false;
    }
}

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
 * 下载图片
 */
async function downloadImage(url, savePath) {
    console.log(`📥 正在下载图片: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`下载失败: ${response.status}`);
        }
        
        const buffer = await response.buffer();
        fs.writeFileSync(savePath, buffer);
        console.log(`✅ 图片下载成功: ${savePath}`);
        return true;
    } catch (error) {
        console.error(`❌ 图片下载失败: ${error.message}`);
        return false;
    }
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
 * 处理单个案件
 */
async function processCase(caseInfo) {
    console.log(`\n🚀 开始处理案件: ${caseInfo.case_id}`);
    
    try {
        // 1. 解析图片URL
        let imagesJson = [];
        if (caseInfo.images_json) {
            imagesJson = typeof caseInfo.images_json === 'string' 
                ? JSON.parse(caseInfo.images_json) 
                : caseInfo.images_json;
        }
        
        const imageCount = imagesJson.length;
        console.log(`📊 找到 ${imageCount} 张图片`);
        
        // 2. 更新图片数量和状态
        await updateCase(caseInfo.case_id, {
            image_count: imageCount,
            image_webp_status: 100
        });
        
        // 3. 如果没有图片，直接标记为成功
        if (imageCount === 0) {
            console.log('⚠️  没有图片需要处理');
            await updateCase(caseInfo.case_id, {
                image_webp_status: 200
            });
            return 'success';
        }
        
        // 4. 创建下载目录
        const downloadDir = createDownloadDir(
            caseInfo.missing_state,
            caseInfo.missing_county,
            caseInfo.missing_city,
            caseInfo.case_id
        );
        
        // 5. 处理每张图片
        let successCount = 0;
        for (let i = 0; i < imagesJson.length; i++) {
            const imageUrl = imagesJson[i];
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
            const uploadSuccess = await uploadToB2(webpPath, caseInfo.case_id, 'evidence');
            if (uploadSuccess) {
                successCount++;
            }
            
            // 清理本地文件
            if (fs.existsSync(originalPath)) {
                fs.unlinkSync(originalPath);
            }
            if (fs.existsSync(webpPath)) {
                fs.unlinkSync(webpPath);
            }
        }
        
        // 6. 更新最终状态
        await updateCase(caseInfo.case_id, {
            image_webp_status: 200,
            image_count: successCount
        });
        
        console.log(`✅ 案件处理完成: ${caseInfo.case_id}`);
        console.log(`📊 处理结果: ${successCount}/${imageCount} 张图片成功`);
        return 'success';
        
    } catch (error) {
        console.error(`❌ 案件处理失败: ${error.message}`);
        console.error('错误详情:', error.stack);
        
        // 更新为错误状态
        await updateCase(caseInfo.case_id, {
            image_webp_status: 500
        });
        
        return 'error';
    }
}

/**
 * 主程序入口
 */
async function main() {
    console.log('🌟 Backblaze B2 图片管理系统 - 升级版本');
    console.log('======================================\n');
    
    const TASK_LIMIT = 2; // 每执行2个任务后停止
    let taskCount = 0;
    
    try {
        while (taskCount < TASK_LIMIT) {
            // 获取下一个案件
            const caseInfo = await getNextCase();
            if (!caseInfo) {
                console.log('📭 没有更多符合条件的案件');
                break;
            }
            
            // 处理案件
            await processCase(caseInfo);
            taskCount++;
            
            // 如果不是最后一个任务，添加延迟
            if (taskCount < TASK_LIMIT) {
                console.log('\n⏳ 等待 5 秒后执行下一个任务...');
                await sleep(5000);
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