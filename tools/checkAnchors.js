const fs = require('fs');
const html = fs.readFileSync('tools/index.html', 'utf8');
const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g;
let count = 0;
while (re.exec(html)) count++;
console.log('anchors:', count);
