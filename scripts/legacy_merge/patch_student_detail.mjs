import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src', 'components', 'crm', 'StudentDetail.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replacements for localized strings that might be hardcoded in English
content = content.replace(/<Label className="text-muted-foreground">Full Name<\/Label>/g, '<Label className="text-muted-foreground">{t(\'auth.fullName\')}</Label>');
content = content.replace(/<Label className="text-muted-foreground">Access Code<\/Label>/g, '<Label className="text-muted-foreground">{t(\'auth.accessCode\')}</Label>');
content = content.replace(/<Label className="text-muted-foreground">Payment Mode<\/Label>/g, '<Label className="text-muted-foreground">{t(\'student.paymentMode\') || \'Payment Mode\'}</Label>');
content = content.replace(/value="profile">Profile<\/TabsTrigger>/g, 'value="profile">{t(\'navigation.profile\')}</TabsTrigger>');
content = content.replace(/value="status">Status<\/TabsTrigger>/g, 'value="status">{t(\'student.applicationStatus\')}</TabsTrigger>');
content = content.replace(/value="calls">Calls<\/TabsTrigger>/g, 'value="calls">{t(\'common.phone\')}</TabsTrigger>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched StudentDetail.tsx');
