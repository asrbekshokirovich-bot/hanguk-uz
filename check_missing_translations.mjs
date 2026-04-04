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

const srcFiles = walk(path.join(process.cwd(), 'src'));
const translationKeysUsed = new Set();
// A valid translation key should not have spaces, commas, etc.
// Typically characters are: alphanumeric, dot, underscore, dash.
const tPattern = /[^a-zA-Z0-9_]t\(['"]([a-zA-Z0-9_\.-]+)['"]\)/g;

srcFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = [...content.matchAll(tPattern)];
  matches.forEach(m => translationKeysUsed.add(m[1]));
});

// Load en.json
const enJsonPath = path.join(process.cwd(), 'src', 'locales', 'en.json');
const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));

// Helper to check if key exists in json object
function isKeyPresent(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }
  return true;
}

const missingKeys = [];
translationKeysUsed.forEach(key => {
  if (!isKeyPresent(enJson, key)) {
    missingKeys.push(key);
  }
});

console.log('--- Missing Translation Keys (' + missingKeys.length + ') ---');
missingKeys.sort().forEach(k => console.log(k));
