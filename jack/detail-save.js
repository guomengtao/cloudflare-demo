const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Cloudflare D1数据库名称（从a.js中获取）
const DATABASE_NAME = 'cloudflare-demo-db';

// 默认案件信息
const defaultCaseInfo = {
    "success": true,
    "caseId": "julianna-m-alvarez",
    "location": {
        "state": "nevada",
        "county": "clark-county",
        "city": "las-vegas"
    },
    "case_details": {
        "case_id": "julianna-m-alvarez",
        "full_name": "Julianna M. Alvarez",
        "date_of_birth": "1991-12-03",
        "missing_since": "2012-05-01",
        "age_at_missing": 20,
        "missing_city": "Las Vegas",
        "missing_state": "Nevada",
        "missing_country": "USA",
        "location_details": "Alvarez was last seen in the 4200 block of North Las Vegas Boulevard in Las Vegas, Nevada on May 1, 2012.",
        "sex": "Female",
        "race": "White",
        "height": "5'9\"",
        "weight": "140 - 160 pounds",
        "eye_color": "Brown",
        "hair_color": "Brown",
        "distinguishing_marks": "Freckles, tattoo on her back of a red rose with 'Julianna' in cursive, wears eyeglasses, nicknames Juju and Julie, slight disability in her left arm preventing it from straightening.",
        "vehicle_info": null,
        "classification": "Missing",
        "investigating_agency": "Las Vegas Metropolitan Police Department 702-828-2907",
        "source_info": "Las Vegas Metropolitan Police Department, NamUs",
        "case_summary": "Julianna M. Alvarez was last seen in the 4200 block of North Las Vegas Boulevard in Las Vegas, Nevada on May 1, 2012. She has never been heard from again, and few details are available in her case. She is a white female, 5'9\" tall, weighing 140-160 pounds, with brown hair and brown eyes. At the time of her disappearance, she was 20 years old. She has freckles, a tattoo on her back of a red rose with 'Julianna' in cursive, and wears eyeglasses. Her nicknames are Juju and Julie, and she has a slight disability in her left arm that prevents it from straightening. She was last seen wearing a pink tank top and black jeans."
    },
    "filePath": "/Users/Banner/Documents/tom/case/nevada/clark-county/las-vegas/julianna-m-alvarez.html",
    "filename": "julianna-m-alvarez.html"
};

// 执行D1数据库命令的函数
async function executeD1Command(sql, params = []) {
    return new Promise((resolve, reject) => {
        // 替换SQL中的?占位符为实际参数
        let processedSql = sql;
        params.forEach(param => {
            let value;
            if (param === null || param === undefined) {
                value = 'NULL';
            } else if (typeof param === 'string') {
                // 转义字符串中的单引号
                value = `'${param.replace(/'/g, "''")}'`;
            } else {
                value = param;
            }
            processedSql = processedSql.replace(/\?/, value);
        });

        // 创建临时SQL文件
        const tempSqlFile = path.join(__dirname, 'temp-query.sql');
        fs.writeFileSync(tempSqlFile, processedSql);
        
        // 使用文件输入方式执行命令
        const command = `npx wrangler d1 execute ${DATABASE_NAME} --remote --json --file="${tempSqlFile}"`;
        
        console.log(`执行数据库命令: ${command}`);
        
        const options = {
            maxBuffer: 10 * 1024 * 1024 // 10MB
        };
        
        exec(command, options, (error, stdout, stderr) => {
            // 删除临时文件
            if (fs.existsSync(tempSqlFile)) {
                fs.unlinkSync(tempSqlFile);
            }
            
            if (error) {
                console.error(`命令执行错误: ${error.message}`);
                reject(error);
                return;
            }
            
            if (stderr) {
                console.error(`命令 stderr: ${stderr}`);
            }
            
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (parseError) {
                console.error(`解析响应错误: ${parseError.message}`);
                resolve({});
            }
        });
    });
}

// 主函数
async function saveCaseDetailsToDatabase(caseInfo = null) {
    // 如果没有传入信息，使用默认信息
    const info = caseInfo || defaultCaseInfo;
    
    // 验证输入信息格式
    if (!info.success || !info.case_details) {
        return {
            success: false,
            error: 'Invalid input format'
        };
    }
    
    const caseDetails = info.case_details;
    
    try {
        // 检查记录是否已存在
        const checkResult = await executeD1Command(
            'SELECT COUNT(*) as count FROM missing_persons_info WHERE case_id = ?',
            [caseDetails.case_id]
        );
        
        const exists = checkResult[0]?.results?.[0]?.count > 0;
        
        if (exists) {
            // 更新现有记录
            await executeD1Command(`
                UPDATE missing_persons_info 
                SET 
                    full_name = ?,
                    date_of_birth = ?,
                    missing_since = ?,
                    age_at_missing = ?,
                    missing_city = ?,
                    missing_state = ?,
                    missing_country = ?,
                    location_details = ?,
                    sex = ?,
                    race = ?,
                    height = ?,
                    weight = ?,
                    eye_color = ?,
                    hair_color = ?,
                    distinguishing_marks = ?,
                    vehicle_info = ?,
                    classification = ?,
                    investigating_agency = ?,
                    source_info = ?,
                    case_summary = ?,
                    analyzed_at = CURRENT_TIMESTAMP
                WHERE case_id = ?
            `, [
                caseDetails.full_name,
                caseDetails.date_of_birth,
                caseDetails.missing_since,
                caseDetails.age_at_missing,
                caseDetails.missing_city,
                caseDetails.missing_state,
                caseDetails.missing_country || 'USA',
                caseDetails.location_details,
                caseDetails.sex,
                caseDetails.race,
                caseDetails.height,
                caseDetails.weight,
                caseDetails.eye_color,
                caseDetails.hair_color,
                caseDetails.distinguishing_marks,
                caseDetails.vehicle_info,
                caseDetails.classification,
                caseDetails.investigating_agency,
                caseDetails.source_info,
                caseDetails.case_summary,
                caseDetails.case_id
            ]);
            
            return {
                success: true,
                action: 'update',
                case_id: caseDetails.case_id,
                message: 'Case details updated successfully'
            };
        } else {
            // 插入新记录
            await executeD1Command(`
                INSERT INTO missing_persons_info 
                (
                    case_id, full_name, date_of_birth, missing_since, age_at_missing,
                    missing_city, missing_state, missing_country, location_details,
                    sex, race, height, weight, eye_color, hair_color, distinguishing_marks,
                    vehicle_info, classification, investigating_agency, source_info, case_summary
                ) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                caseDetails.case_id,
                caseDetails.full_name,
                caseDetails.date_of_birth,
                caseDetails.missing_since,
                caseDetails.age_at_missing,
                caseDetails.missing_city,
                caseDetails.missing_state,
                caseDetails.missing_country || 'USA',
                caseDetails.location_details,
                caseDetails.sex,
                caseDetails.race,
                caseDetails.height,
                caseDetails.weight,
                caseDetails.eye_color,
                caseDetails.hair_color,
                caseDetails.distinguishing_marks,
                caseDetails.vehicle_info,
                caseDetails.classification,
                caseDetails.investigating_agency,
                caseDetails.source_info,
                caseDetails.case_summary
            ]);
            
            return {
                success: true,
                action: 'insert',
                case_id: caseDetails.case_id,
                message: 'Case details inserted successfully'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 处理命令行输入
async function main() {
    let inputCaseInfo = null;
    
    // 检查是否有命令行参数
    if (process.argv.length > 2) {
        try {
            // 解析命令行参数中的JSON
            inputCaseInfo = JSON.parse(process.argv[2]);
            console.log('📥 使用命令行传入的案件信息');
        } catch (parseError) {
            console.log('❌ 命令行参数解析失败，使用默认信息');
        }
    } else {
        console.log('📋 使用默认案件信息');
    }
    
    // 执行保存操作
    const result = await saveCaseDetailsToDatabase(inputCaseInfo);
    
    // 输出结果
    console.log(JSON.stringify(result, null, 2));
}

// 执行主函数
main().catch(error => {
    console.error('💥 程序执行出错:', error);
    console.log(JSON.stringify({ success: false, error: error.message }));
});

// 导出函数供其他模块使用
module.exports = { saveCaseDetailsToDatabase };