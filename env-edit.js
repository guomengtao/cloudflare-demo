// 读取环境变量 TASK_WEBP 并加1
// 抑制 dotenv 输出
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

console.log = function() {};
console.error = function() {};
console.warn = function() {};
console.info = function() {};

require('dotenv').config();

// 恢复原始控制台方法
console.log = originalConsoleLog;
console.error = originalConsoleError;
console.warn = originalConsoleWarn;
console.info = originalConsoleInfo;

// 获取 TASK_WEBP 变量
const taskWebp = process.env.TASK_WEBP;

// 转换为数字并加1
if (taskWebp) {
    const currentId = parseInt(taskWebp);
    if (!isNaN(currentId)) {
        const nextId = currentId + 1;
        console.log(nextId);
    } else {
        console.error('TASK_WEBP 不是有效的数字');
        process.exit(1);
    }
} else {
    console.error('TASK_WEBP 环境变量未设置');
    process.exit(1);
}