import * as fs from 'fs';
const data = fs.readFileSync('c:/Users/user/Desktop/Anti gravity/hanguk/Hanguk/src/components/crm/pages/ApplicationFormsContent.tsx', 'utf-8');
const lines = data.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].toLowerCase().includes('izoh') || lines[i].toLowerCase().includes('tanlang')) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
  }
}
