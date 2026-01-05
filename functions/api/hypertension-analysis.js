// 高血压分析 API 实现
// 基于《2024中国高血压防治指南》的规则引擎分析

// 定义可用的AI模型
const availableModels = [
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/mistral/mistral-7b-instruct-v0.3',
    '@cf/google/gemma-7b-it',
    '@cf/qwen/qwen1.5-7b-chat',
    '@cf/microsoft/phi-3-mini-4k-instruct'
];

// 生成AI分析的提示词
function generateAIPrompt(patientData) {
    const { age, gender, systolic, diastolic, medication, smoking, swelling, otherConditions } = patientData;
    
    // 将其他疾病转换为可读格式
    const conditionsMap = {
        'diabetes': '糖尿病',
        'heartDisease': '冠心病',
        'kidneyDisease': '肾脏疾病',
        'stroke': '脑卒中',
        'hyperlipidemia': '高脂血症',
        'none': '无'
    };
    
    // 使用三元运算符处理默认值，避免常量重新赋值
    const readableConditions = (otherConditions
        .filter(cond => cond !== 'none' && conditionsMap[cond])
        .map(cond => conditionsMap[cond])
        .join('、')) || '无';
    
    // 将吸烟状态转换为可读格式
    const smokingMap = {
        'yes': '是',
        'no': '否',
        'quit': '已戒烟'
    };
    
    const readableSmoking = smokingMap[smoking] || '未知';
    
    // 将性别转换为可读格式
    const genderMap = {
        'male': '男',
        'female': '女'
    };
    
    const readableGender = genderMap[gender] || '未知';
    
    return `请根据《2024中国高血压防治指南》分析以下高血压患者的病情：

患者信息：
- 年龄：${age}岁
- 性别：${readableGender}
- 血压：${systolic}/${diastolic} mmHg
- 当前用药：${medication}
- 吸烟状况：${readableSmoking}
- 脚肿症状：${swelling === 'yes' ? '有' : '无'}
- 其他基础疾病：${readableConditions}

请按照以下结构输出分析结果：
1. 当前风险画像（包括判定等级和依据）
2. 核心预警（包括血压分级和建议时间）
3. 症状解析（特别是脚肿的原因分析）
4. 生活干预建议（特别是戒烟建议）
5. 综合建议

请使用专业、清晰的语言进行分析，严格遵循《2024中国高血压防治指南》的标准。`;
}

// 处理OPTIONS请求（CORS预检）
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        },
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        // 添加请求日志
        console.log('=== 高血压分析 API Request Received ===');
        console.log('Request method:', request.method);
        console.log('Request URL:', new URL(request.url).pathname);
        
        // 解析前端传来的表单数据
        const formData = await request.json();
        console.log('Request body:', formData);
        
        // 验证输入
        if (!validateFormData(formData)) {
            console.log('Invalid form data received:', formData);
            return new Response(JSON.stringify({ 
                error: 'Invalid form data',
                debug: { received: formData }
            }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        
        // 获取用户选择的模型
        const selectedModel = formData.aiModel && availableModels.includes(formData.aiModel) 
            ? formData.aiModel 
            : '@cf/meta/llama-3.1-8b-instruct';
        
        // 生成AI分析提示词
        const aiPrompt = generateAIPrompt(formData);
        
        // 调用Cloudflare Workers AI
        console.log('Calling AI model:', selectedModel);
        console.log('AI Prompt:', aiPrompt);
        
        // 检查env.AI是否可用
        if (!env.AI) {
            throw new Error('Cloudflare Workers AI is not available. Please check your environment configuration.');
        }
        
        // 添加超时控制
        const aiResponse = await Promise.race([
            env.AI.run(
                selectedModel,
                {
                    messages: [
                        { role: 'system', content: '你是一位严格遵循《2024中国高血压防治指南》的医生。请按照用户要求的格式输出分析结果。' },
                        { role: 'user', content: aiPrompt }
                    ],
                    max_tokens: 1024,
                    temperature: 0.1
                }
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI request timeout')), 30000))
        ]);
        
        console.log('AI Response:', aiResponse);
        
        // 获取AI响应内容
        let aiContent;
        if (typeof aiResponse === 'object' && aiResponse !== null) {
            aiContent = aiResponse.response || aiResponse.answer || JSON.stringify(aiResponse);
        } else {
            aiContent = String(aiResponse);
        }
        
        // 同时执行传统分析作为参考
        const traditionalAnalysis = analyzeHypertension(formData);
        
        // 返回分析结果
        console.log('Successfully processed request, returning analysis result');
        const responseData = {
            bloodPressure: `${formData.systolic}/${formData.diastolic}`,
            bloodPressureLevel: traditionalAnalysis.bloodPressureLevel,
            riskLevel: traditionalAnalysis.riskLevel,
            aiAnalysis: aiContent,
            selectedModel: selectedModel
        };
        
        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('=== 高血压分析 API Error ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // 构建更详细的错误响应
        const errorResponse = {
            error: 'Internal server error',
            message: error.message,
            details: process.env.NODE_ENV === 'production' ? undefined : error.stack,
            timestamp: new Date().toISOString()
        };
        
        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// 根据《2024中国高血压防治指南》进行传统分析
function analyzeHypertension(data) {
    // 1. 血压分级
    const bloodPressureLevel = getBloodPressureLevel(data.systolic, data.diastolic);
    
    // 2. 风险分层
    const riskLevel = getRiskLevel(data);
    
    // 3. 症状解析（脚肿）
    const swellingAnalysis = getSwellingAnalysis(data);
    
    // 4. 戒烟建议
    const smokingAdvice = getSmokingAdvice(data);
    
    // 5. 综合建议
    const comprehensiveAdvice = getComprehensiveAdvice(data, riskLevel);
    
    // 6. 达标建议时间
    const recommendationPeriod = getRecommendationPeriod(riskLevel);
    
    return {
        bloodPressureLevel,
        riskLevel,
        swellingAnalysis,
        smokingAdvice,
        comprehensiveAdvice,
        recommendationPeriod
    };
}

// 根据《2024中国高血压防治指南》确定血压分级
function getBloodPressureLevel(systolic, diastolic) {
    if (systolic < 120 && diastolic < 80) {
        return '理想血压';
    } else if (systolic < 130 && diastolic < 85) {
        return '正常血压';
    } else if ((systolic >= 130 && systolic < 140) || (diastolic >= 85 && diastolic < 90)) {
        return '正常高值';
    } else if ((systolic >= 140 && systolic < 160) || (diastolic >= 90 && diastolic < 100)) {
        return '1级高血压';
    } else if ((systolic >= 160 && systolic < 180) || (diastolic >= 100 && diastolic < 110)) {
        return '2级高血压';
    } else if (systolic >= 180 || diastolic >= 110) {
        return '3级高血压';
    } else {
        return '血压异常';
    }
}

// 根据《2024中国高血压防治指南》确定风险分层
function getRiskLevel(data) {
    const { age, gender, systolic, diastolic, smoking, otherConditions = [] } = data;
    
    // 计算危险因素
    let riskFactors = 0;
    
    // 年龄因素
    if ((gender === 'male' && age >= 55) || (gender === 'female' && age >= 65)) {
        riskFactors++;
    }
    
    // 吸烟因素
    if (smoking === 'yes') {
        riskFactors++;
    }
    
    // 血压分级因素
    const bpLevel = getBloodPressureLevel(systolic, diastolic);
    if (bpLevel.includes('1级')) {
        riskFactors += 2;
    } else if (bpLevel.includes('2级')) {
        riskFactors += 3;
    } else if (bpLevel.includes('3级')) {
        riskFactors += 4;
    }
    
    // 其他疾病因素
    const conditionsArray = Array.isArray(otherConditions) ? otherConditions : [];
    if (conditionsArray.includes('diabetes') || conditionsArray.includes('heartDisease') || 
        conditionsArray.includes('kidneyDisease') || conditionsArray.includes('stroke')) {
        riskFactors += 3;
    }
    if (conditionsArray.includes('hyperlipidemia')) {
        riskFactors++;
    }
    
    // 确定风险等级
    if (riskFactors < 3) {
        return '低危';
    } else if (riskFactors < 5) {
        return '中危';
    } else if (riskFactors < 7) {
        return '高危';
    } else {
        return '很高危';
    }
}

// 脚肿症状分析
function getSwellingAnalysis(data) {
    const { medication, swelling } = data;
    
    if (swelling === 'no') {
        return '目前无脚肿症状，建议继续观察。';
    }
    
    // 根据用药情况分析脚肿原因（支持多选用药）
    const medications = Array.isArray(medication) ? medication : [medication];
    
    if (medications.includes('地平类')) {
        return '您服用的地平类药物可能引起脚肿的不良反应。地平类药物通过扩张小动脉降低血压，但可能导致体液在下肢潴留，引起脚肿。建议咨询医生是否需要调整用药方案，如联用ACEI或ARB类药物，或更换其他类型的降压药物。';
    } else if (medications.includes('利尿剂')) {
        return '利尿剂一般不会引起脚肿，反而有减轻水肿的作用。您的脚肿可能与其他因素有关，建议咨询医生进一步检查。';
    } else {
        return '脚肿可能与多种因素有关，如长时间站立、心力衰竭、肾脏疾病等。建议监测脚肿的变化，如有加重或伴随其他症状（如呼吸困难、尿量减少等），及时就医。';
    }
}

// 综合建议
function getComprehensiveAdvice(data, riskLevel) {
    const { systolic, diastolic, medication } = data;
    
    let advice = '';
    
    // 根据风险等级给出建议
    if (riskLevel === '低危') {
        advice += '您的高血压风险等级为低危，建议采取生活方式干预，包括：控制钠盐摄入（每日不超过5g）、增加钾盐摄入（多吃新鲜蔬菜和水果）、控制体重（BMI目标值18.5-23.9kg/m²）、适量运动（每周至少150分钟中等强度有氧运动）、戒烟限酒、保持心理平衡。';
    } else if (riskLevel === '中危') {
        advice += '您的高血压风险等级为中危，建议在生活方式干预的基础上，';
        
        // 检查是否服用任何降压药物
        const medications = Array.isArray(medication) ? medication : [medication];
        const isTakingMedication = medications.some(med => med !== 'none' && med !== '未服用降压药物');
        
        if (!isTakingMedication) {
            advice += '考虑启动降压药物治疗。';
        } else {
            advice += '继续规范服用降压药物。';
        }
    } else {
        advice += '您的高血压风险等级为' + (riskLevel === '高危' ? '高危' : '很高危') + '，';
        
        // 检查是否服用任何降压药物
        const medications = Array.isArray(medication) ? medication : [medication];
        const isTakingMedication = medications.some(med => med !== 'none' && med !== '未服用降压药物');
        
        if (!isTakingMedication) {
            advice += '建议立即启动降压药物治疗，并严格进行生活方式干预。';
        } else {
            advice += '建议严格按照医嘱服用降压药物，并加强生活方式干预。';
        }
        advice += '定期监测血压，建议每周至少测量3次血压，并记录血压变化。';
    }
    
    // 根据血压水平给出建议
    const bpLevel = getBloodPressureLevel(data.systolic, data.diastolic);
    if (bpLevel.includes('2级') || bpLevel.includes('3级')) {
        advice += '您目前的血压水平较高，建议及时就医，调整治疗方案，争取在较短时间内将血压控制在目标范围内。';
    }
    
    return advice;
}

// 验证表单数据（更新以支持多选用药）
function validateFormData(data) {
    const { age, gender, systolic, diastolic, medication, smoking, swelling, otherConditions } = data;
    
    // 基本字段验证
    if (age === undefined || gender === undefined || systolic === undefined || diastolic === undefined ||
        medication === undefined || smoking === undefined || swelling === undefined) {
        return false;
    }
    
    // 数值范围验证
    if (age < 1 || age > 120) return false;
    if (systolic < 60 || systolic > 250) return false;
    if (diastolic < 40 || diastolic > 150) return false;
    
    // 选项验证
    const validGenders = ['male', 'female'];
    const validMedications = ['none', '地平类', 'ACEI', 'ARB', '利尿剂', 'β受体阻滞剂', '其他', '未服用降压药物'];
    const validSmoking = ['yes', 'no', 'quit'];
    const validSwelling = ['yes', 'no'];
    
    if (!validGenders.includes(gender)) return false;
    if (!validSmoking.includes(smoking)) return false;
    if (!validSwelling.includes(swelling)) return false;
    
    // 验证 medication 字段（支持数组或字符串）
    if (Array.isArray(medication)) {
        for (const med of medication) {
            if (!validMedications.includes(med)) {
                return false;
            }
        }
    } else {
        if (!validMedications.includes(medication)) {
            return false;
        }
    }
    
    // 验证 otherConditions 字段
    if (otherConditions !== undefined && !Array.isArray(otherConditions)) {
        return false;
    }
    
    return true;
}

// 戒烟建议
function getSmokingAdvice(data) {
    const { smoking } = data;
    
    if (smoking === 'no') {
        return '您目前不吸烟，建议继续保持，避免二手烟暴露。';
    } else if (smoking === 'quit') {
        return '恭喜您已经戒烟！戒烟可以显著降低心血管疾病风险，建议继续保持，并定期进行健康检查。';
    } else {
        return '吸烟是心血管疾病的重要危险因素，会使血管弹性下降，增加卒中风险约2-4倍。根据《2024中国高血压防治指南》，戒烟是高血压患者生活方式干预的I级推荐措施。建议您立即戒烟，并避免二手烟暴露。';
    }
}

// 达标建议时间
function getRecommendationPeriod(riskLevel) {
    if (riskLevel === '低危') {
        return '建议3-6个月内将血压控制在目标范围内（<140/90 mmHg，如合并糖尿病或肾脏疾病，目标<130/80 mmHg）。';
    } else if (riskLevel === '中危') {
        return '建议2-3个月内将血压控制在目标范围内（<140/90 mmHg，如合并糖尿病或肾脏疾病，目标<130/80 mmHg）。';
    } else {
        return '建议1个月内将血压控制在目标范围内（<140/90 mmHg，如合并糖尿病或肾脏疾病，目标<130/80 mmHg）。';
    }
}