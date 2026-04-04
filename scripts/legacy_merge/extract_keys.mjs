import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const sf = walk('supabase/functions');
const denoKeys = new Set();
sf.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = [...content.matchAll(/Deno\.env\.get\(['"]([^'"]+)['"]\)/g)];
  matches.forEach(m => denoKeys.add(m[1]));
});
console.log('--- Edge Function Environment Variables ---');
Array.from(denoKeys).sort().forEach(k => console.log(k));

const src = walk('src');
const viteKeys = new Set();
src.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = [...content.matchAll(/import\.meta\.env\.VITE_[A-Z0-9_]+/g)];
  matches.forEach(m => viteKeys.add(m[0]));
});
console.log('\n--- Frontend (Vite) Environment Variables ---');
Array.from(viteKeys).sort().forEach(k => console.log(k));
