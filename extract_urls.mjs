import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    if (fs.statSync(file).isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const sf = walk('supabase/functions');
const urls = new Set();
sf.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = [...content.matchAll(/https:\/\/[^'"`\s\\]+/g)];
  matches.forEach(m => urls.add(m[0]));
});

console.log(Array.from(urls).sort().join('\n'));
