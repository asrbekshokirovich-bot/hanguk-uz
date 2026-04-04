import * as fs from 'fs';

function findValue(obj, valToFind, path = "") {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      if (v.toLowerCase().includes('izoh') || v.toLowerCase().includes('dona') || v.toLowerCase().includes('tanlang')) {
        console.log(`${path}.${k} = ${v}`);
      }
    } else if (typeof v === 'object' && v !== null) {
      findValue(v, valToFind, `${path}.${k}`);
    }
  }
}

const data = JSON.parse(fs.readFileSync('c:/Users/user/Desktop/Anti gravity/hanguk/Hanguk/src/locales/uz.json', 'utf-8'));
findValue(data, 'izoh');
