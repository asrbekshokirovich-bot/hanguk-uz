import fs from 'fs';
import path from 'path';

const filePaths = [
  path.join(process.cwd(), 'src', 'components', 'crm', 'CRMSidebar.tsx'),
  path.join(process.cwd(), 'src', 'components', 'intercom', 'SidebarStaffPanel.tsx')
];

for (const filePath of filePaths) {
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // CRMSidebar replacements
  content = content.replace(/lang === 'uz' \? 'Dashboard' : t\('navigation\.dashboard'\)/g, "t('navigation.dashboard')");
  content = content.replace(/title: 'Hanguk AI'/g, "title: 'Hanguk AI'"); // Static is fine
  content = content.replace(/lang === 'uz' \? 'Aloqa' : 'Communication'/g, "t('navigation.communication')");
  content = content.replace(/lang === 'uz' \? 'Jonli Qo\\'ng\\'iroq' : 'Live Call'/g, "t('navigation.liveCall')");
  content = content.replace(/title: 'Leads'/g, "title: t('navigation.leads')");
  content = content.replace(/lang === 'uz' \? 'Boshqaruv' : 'Management'/g, "t('navigation.management')");
  content = content.replace(/lang === 'uz' \? 'Ariza Topish' : 'Form Finder'/g, "t('navigation.formFinder')");
  content = content.replace(/title: 'AI Tarjima'/g, "title: t('navigation.aiTranslation')");
  content = content.replace(/title: 'Kakao Map'/g, "title: t('navigation.kakaoMap')");
  content = content.replace(/lang === 'uz' \? 'Moliya' : 'Finance'/g, "t('navigation.finance')");
  content = content.replace(/lang === 'uz' \? 'Umumiy' : 'Overview'/g, "t('navigation.overview')");
  content = content.replace(/lang === 'uz' \? 'Budjetlar' : 'Budgets'/g, "t('navigation.budgets')");
  content = content.replace(/lang === 'uz' \? 'Oylik' : 'Monthly'/g, "t('navigation.monthly')");
  content = content.replace(/lang === 'uz' \? 'Rejali' : 'Scheduled'/g, "t('navigation.scheduled')");
  content = content.replace(/lang === 'uz' \? 'Tranzaksiyalar' : 'Transactions'/g, "t('navigation.transactions')");
  content = content.replace(/lang === 'uz' \? 'Taqsimlash' : 'Distribution'/g, "t('navigation.distribution')");
  content = content.replace(/lang === 'uz' \? 'Bonuslar' : 'Bonuses'/g, "t('navigation.bonuses')");
  content = content.replace(/lang === 'uz' \? 'Hisobotlar' : 'Reports'/g, "t('navigation.reports')"); // it already uses reports
  content = content.replace(/title: 'Admin'/g, "title: t('navigation.admin')");

  // SidebarStaffPanel replacements
  // Using \` syntax replacements
  content = content.replace(/`Ovozli aloqa \(\${onlineCount} online\)`/g, "`\${t('navigation.voiceChat')} (\${onlineCount} online)`");
  content = content.replace(/'Ovozli aloqa'/g, "t('navigation.voiceChat')");

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${path.basename(filePath)}`);
}
