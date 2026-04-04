import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'locales');
const newKeys = {
  en: {
    auth: { username: "Username", accessCode: "Access Code" },
    student: { paymentMode: "Payment Mode" }
  },
  uz: {
    auth: { username: "Foydalanuvchi nomi", accessCode: "Kirish kodi" },
    student: { paymentMode: "To'lov turi" }
  },
  ko: {
    auth: { username: "사용자 이름", accessCode: "액세스 코드" },
    student: { paymentMode: "결제 방식" }
  },
  ru: {
    auth: { username: "Имя пользователя", accessCode: "Код доступа" },
    student: { paymentMode: "Способ оплаты" }
  }
};

for (const [lang, translations] of Object.entries(newKeys)) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) continue;
  
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  Object.assign(content.auth, translations.auth);
  Object.assign(content.student, translations.student);
  
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`Updated ${lang}.json with new keys`);
}
