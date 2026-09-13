import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.vue')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
let count = 0;

const tagRegex = /<(input|select|textarea)\b([^>]*)>/gs;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const attrs = match[2];
    
    // ignore checkboxes, radios, file inputs, hidden
    if (attrs.includes('type="checkbox"') || 
        attrs.includes('type="radio"') || 
        attrs.includes('type="file"') || 
        attrs.includes('display:none') ||
        attrs.includes('display: none')) {
      continue;
    }
    
    // if inside search-box or inv-search, they might be styled by parent container .search-box input
    const isStyledByParent = attrs.includes('search-box') || attrs.includes('inv-search');
    
    // check if it has class with val-input or something equivalent
    if (!attrs.includes('val-input') && !attrs.includes('class="btn') && !isStyledByParent) {
      // get line number
      const lineNo = content.substring(0, match.index).split('\n').length;
      console.log(`${f}:${lineNo} -> ${fullTag.replace(/\s+/g, ' ').slice(0, 120)}`);
      count++;
    }
  }
});
console.log(`Real unstyled inputs count: ${count}`);
