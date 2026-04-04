import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'locales');
const newKeys = {
  en: {
    voiceList: { 
      connecting: "Connecting...", 
      clickToStart: "Click staff to start speaking",
      reconnect: "Click mic icon to reconnect",
      pressAndHold: "Press and hold to speak",
      noOtherStaff: "No other staff",
      error: "Error"
    }
  },
  uz: {
    voiceList: { 
      connecting: "Ulanmoqda...", 
      clickToStart: "Xodim ustini bosib gaplashni boshlang",
      reconnect: "Qayta ulanish uchun mikrofon ikonkasini bosing",
      pressAndHold: "Bosib turing va gaplashing",
      noOtherStaff: "Boshqa xodimlar yo'q",
      error: "Xatolik"
    }
  },
  ko: {
    voiceList: { 
      connecting: "연결 중...", 
      clickToStart: "직원을 클릭하여 말하기",
      reconnect: "마이크 아이콘을 눌러 재연결",
      pressAndHold: "길게 눌러 말하기",
      noOtherStaff: "다른 직원이 없습니다",
      error: "오류"
    }
  },
  ru: {
    voiceList: { 
      connecting: "Подключение...", 
      clickToStart: "Нажмите на сотрудника, чтобы говорить",
      reconnect: "Нажмите значок микрофона для повторного подключения",
      pressAndHold: "Нажмите и удерживайте, чтобы говорить",
      noOtherStaff: "Нет других сотрудников",
      error: "Ошибка"
    }
  }
};

for (const [lang, translations] of Object.entries(newKeys)) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) continue;
  
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!content.voiceList) content.voiceList = {};
  Object.assign(content.voiceList, translations.voiceList);
  
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
}
console.log('Locales updated for voiceList');

let tsxPath = path.join(process.cwd(), 'src', 'components', 'intercom', 'SidebarStaffPanel.tsx');
let tsxContent = fs.readFileSync(tsxPath, 'utf8');

tsxContent = tsxContent.replace(/'Boshqa xodimlar yo\\'q'/g, "t('voiceList.noOtherStaff')");
tsxContent = tsxContent.replace(/'Xatolik'/g, "t('voiceList.error')");
tsxContent = tsxContent.replace(/'Ulanmoqda...'/g, "t('voiceList.connecting')");
tsxContent = tsxContent.replace(/'Bosib gaplashing \\(ulanish uchun bosing\\)'/g, "t('voiceList.clickToStart')");
tsxContent = tsxContent.replace(/'Qayta ulanish uchun mikrofon ikonkasini bosing'/g, "t('voiceList.reconnect')");
tsxContent = tsxContent.replace(/'Bosib turing va gaplashing'/g, "t('voiceList.pressAndHold')");
tsxContent = tsxContent.replace(/'Xodim ustini bosib gaplashni boshlang'/g, "t('voiceList.clickToStart')");

fs.writeFileSync(tsxPath, tsxContent, 'utf8');
console.log('SidebarStaffPanel replaced');
