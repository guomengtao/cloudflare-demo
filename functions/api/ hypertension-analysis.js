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
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 根据《2024中国高血压防治指南》进行分析
        const analysisResult = analyzeHypertension(formData);
        
        // 返回分析结果
        console.log('Successfully processed request, returning analysis result');
        return new Response(JSON.stringify(analysisResult), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('=== 高血压分析 API Error ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return new Response(JSON.stringify({ 
            error: 'Internal server error',
            details: error.message,
            debug: {
                name: error.name,
                stack: error.stack.split('\n'),
                timestamp: new Date().toISOString()
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 验证表单数据
function validateFormData(data) {
    // 基本验证
    if (!data || typeof data !== 'object') return false;
    
    // 验证必要字段
    const requiredFields = ['age', 'gender', 'systolic', 'diastolic', 'medication', 'smoking', 'swelling'];
    for (const field of requiredFields) {
        if (data[field] === undefined || data[field] === null) return false;
    }
    
    // 验证数值范围
    if (data.age < 1 || data.age > 120) return false;
    if (data.systolic < 60 || data.systolic > 250) return false;
    if (data.diastolic < 40 || data.diastolic > 150) return false;
    
    return true;
}

// 根据《2024中国高血压防治指南》进行分析
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
        bloodPressure: `${data.systolic}/${data.diastolic}`,
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
    const { age, gender, systolic, diastolic, smoking, otherConditions } = data;
    
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
    if (otherConditions.includes('diabetes') || otherConditions.includes('heartDisease') || 
        otherConditions.includes('kidneyDisease') || otherConditions.includes('stroke')) {
        riskFactors += 3;
    }
    if (otherConditions.includes('hyperlipidemia')) {
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
    
    // 根据用药情况分析脚肿原因
    if (medication === '地平类') {
        return '您服用的地平类药物可能引起脚肿的不良反应。地平类药物通过扩张小动脉降低血压，但可能导致体液在下肢潴留，引起脚肿。建议咨询医生是否需要调整用药方案，如联用ACEI或ARB类药物，或更换其他类型的降压药物。';
    } else if (medication === '利尿剂') {
        return '利尿剂一般不会引起脚肿，反而有减轻水肿的作用。您的脚肿可能与其他因素有关，建议咨询医生进一步检查。';
    } else {
        return '脚肿可能与多种因素有关，如长时间站立、心力衰竭、肾脏疾病等。建议监测脚肿的变化，如有加重或伴随其他症状（如呼吸困难、尿量减少等），应及时就医。';
    }
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

// 综合建议
function getComprehensiveAdvice(data, riskLevel) {
    const { systolic, diastolic, medication } = data;
    
    let advice = '';
    
    // 根据风险等级给出建议
    if (riskLevel === '低危') {
        advice += '您的高血压风险等级为低危，建议采取生活方式干预，包括：控制钠盐摄入（每日不超过5g）、增加钾盐摄入（多吃新鲜蔬菜和水果）、控制体重（BMI目标值18.5-23.9kg/m²）、适量运动（每周至少150分钟中等强度有氧运动）、戒烟限酒、保持心理平衡。';
    } else if (riskLevel === '中危') {
        advice += '您的高血压风险等级为中危，建议在生活方式干预的基础上，';
        if (medication === 'none') {
            advice += '考虑启动降压药物治疗。';
        } else {
            advice += '继续规范服用降压药物。';
        }
    } else {
        advice += '您的高血压风险等级为' + (riskLevel === '高危' ? '高危' : '很高危') + '，';
        if (medication === 'none') {
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

// 验证表单数据
function validateFormData(data) {
    const { age, gender, systolic, diastolic, medication, smoking, swelling } = data;
    
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
    const validMedications = ['none', '地平类', 'ACEI', 'ARB', '利尿剂', 'β受体阻滞剂', '其他'];
    const validSmoking = ['yes', 'no', 'quit'];
    const validSwelling = ['yes', 'no'];
    
    if (!validGenders.includes(gender)) return false;
    if (!validMedications.includes(medication)) return false;
    if (!validSmoking.includes(smoking)) return false;
    if (!validSwelling.includes(swelling)) return false;
    
    return true;
}
