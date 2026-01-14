const testObj = { task: 'webp', value: '891' };
const jsonStr = JSON.stringify(testObj);
console.log(jsonStr);
console.log('Length:', jsonStr.length);
console.log('Chars:', JSON.stringify(jsonStr).split('').map((c, i) => `${i}: ${c}`).join(', '));