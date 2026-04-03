import fs from 'fs';
import path from 'path';

const functionsDir = path.resolve('supabase/functions');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.resolve(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(fullPath));
        } else if (fullPath.endsWith('.ts')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walkDir(functionsDir);
let changedCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. Replace endpoint
    content = content.replace(/https:\/\/ai\.gateway\.lovable\.dev\/v1\/chat\/completions/g, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    
    // 2. Replace ENV var key
    content = content.replace(/LOVABLE_API_KEY/g, 'GEMINI_API_KEY');
    
    // 3. Replace variable name
    content = content.replace(/lovableApiKey/g, 'geminiApiKey');
    content = content.replace(/lovable/gi, 'gemini');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${path.relative(functionsDir, file)}`);
        changedCount++;
    }
}

console.log(`Successfully refactored ${changedCount} edge functions!`);
