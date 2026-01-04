// 从 data 中获取 otherConditions 并设置默认值为空数组
const { age, gender, systolic, diastolic, smoking, otherConditions = [] } = data;

// ...

// 确保 otherConditions 是数组
const conditionsArray = Array.isArray(otherConditions) ? otherConditions : [];
if (conditionsArray.includes('diabetes') || conditionsArray.includes('heartDisease') || 
    conditionsArray.includes('kidneyDisease') || conditionsArray.includes('stroke')) {
    riskFactors += 3;
}
if (conditionsArray.includes('hyperlipidemia')) {
    riskFactors++;
}
