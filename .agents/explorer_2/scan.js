const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk('./src');
const myanmarRegex = /[\u1000-\u109F]/;

const findings = [];

files.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();
    
    // Skip empty lines, single line comments, imports, require, console.log, standard API routes like fetch('/api/...')
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('import ') || trimmed.startsWith('export {')) {
      return;
    }
    
    // Check if line contains '/' AND Myanmar characters (or ' / ' pattern in JSX text or string literals)
    if (line.includes('/')) {
      // Check if it's a dual language string:
      // Pattern 1: Has Myanmar characters and '/'
      // Pattern 2: Has ' / ' between words inside string quotes or JSX text (e.g. "English / Myanmar")
      const hasMyanmar = myanmarRegex.test(line);
      const hasDualSlashInString = /"([^"\n]*?\s*\/\s*[^"\n]*?)"|'([^'\n]*?\s*\/\s*[^'\n]*?)'|`([^`\n]*?\s*\/\s*[^`\n]*?)`|>([^<\n]*?\s*\/\s*[^<\n]*?)</.test(line);
      
      // Let's filter out non-UI slash uses like:
      // - API endpoint strings: "/api/..."
      // - Math/division: a / b
      // - HTML closing tags: </div
      // - Regex literals: /pattern/
      // - className or Tailwind classes (unless in string props like title="... / ...")
      // - Date formats like "MMM d, yyyy" or "yyyy/MM/dd" (unless bilingual)
      // - MIME types like "application/json"
      
      if (hasMyanmar || hasDualSlashInString) {
        // Exclude common false positives
        if (trimmed.includes('fetch(') || trimmed.includes('from "') || trimmed.includes('from \'') || trimmed.includes('application/json')) {
          return;
        }
        
        // Let's check if the slash is part of a dual-language label
        // E.g. "Dashboard / ဒက်ရှ်ဘုတ်", "POS / အရောင်း", "CUSTOMER / အမည်", title="Select language / ဘာသာစကား", etc.
        findings.push({
          file: filePath.replace(/\\/g, '/'),
          lineNum,
          content: trimmed
        });
      }
    }
  });
});

console.log(`Found ${findings.length} potential lines.`);
fs.writeFileSync('.agents/explorer_2/raw_findings.json', JSON.stringify(findings, null, 2));
