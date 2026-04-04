import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src', 'locales');
const newKeys = {
  en: {
    student: { contracted: "Contracted", noContract: "No Contract", newContracts: "New Contracts" }
  },
  uz: {
    student: { contracted: "Shartnomali", noContract: "Shartnoma yo'q", newContracts: "Yangi shartnomalar" }
  },
  ko: {
    student: { contracted: "계약됨", noContract: "계약 없음", newContracts: "새 계약" }
  },
  ru: {
    student: { contracted: "По контракту", noContract: "Без контракта", newContracts: "Новые контракты" }
  }
};

for (const [lang, translations] of Object.entries(newKeys)) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) continue;
  
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!content.student) content.student = {};
  Object.assign(content.student, translations.student);
  
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
}
console.log('Locales updated for Shartnomali');

const filesToPatch = [
  path.join(process.cwd(), 'src', 'components', 'crm', 'StudentCard.tsx'),
  path.join(process.cwd(), 'src', 'components', 'crm', 'StudentList.tsx'),
  path.join(process.cwd(), 'src', 'components', 'crm', 'pages', 'LeadsContent.tsx')
];

for (const filePath of filesToPatch) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping missing file: ${filePath}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace raw Shartnomali tags
  content = content.replace(/>\s*Shartnomali\s*</g, '>{t(\'student.contracted\')}<');
  content = content.replace(/'Shartnomali'/g, 't(\'student.contracted\')');
  content = content.replace(/"Shartnomali"/g, 't(\'student.contracted\')');
  
  content = content.replace(/>\s*Shartnoma yo'q\s*</g, '>{t(\'student.noContract\')}<');
  
  content = content.replace(/>\s*Yangi shartnomalar\s*</g, '>{t(\'student.newContracts\')}<');
  content = content.replace(/Yangi shartnomalar \(/g, '{t(\'student.newContracts\')} (');
  
  // Specific complex replacement in StudentCard for "Shartnomali{planLabels...}"
  content = content.replace(/Shartnomali\s*\{planLabels/g, '{t(\'student.contracted\')} {planLabels');

  // Specific check for StudentCard.tsx importing useTranslation
  if (path.basename(filePath) === 'LeadsContent.tsx') {
    // Check if useTranslation is inside LeadsContent
    if (!content.includes('const { t } = useTranslation()')) {
      content = content.replace(/const \{ toast \} = useToast\(\);/, 'const { toast } = useToast();\n  const { t } = useTranslation();');
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('TypeScript files patched for Shartnomali');
