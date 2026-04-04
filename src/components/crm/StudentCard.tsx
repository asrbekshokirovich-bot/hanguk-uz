import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Phone, 
  FileText, 
  GraduationCap,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  ScrollText
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { normalizePlanName } from '@/hooks/useStudentPlan';

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & {
    university?: Tables<'universities'>;
  })[];
  documents?: Tables<'documents'>[];
};

interface StudentCardProps {
  student: StudentProfile;
  onSelect?: (student: StudentProfile) => void;
  currentLang: string;
}

const statusSteps = [
  'documents_collection',
  'documents_translation',
  'apostille',
  'application_submitted',
  'university_response',
  'visa_documents',
  'completed'
];

export function StudentCard({ student, onSelect, currentLang }: StudentCardProps) {
  const { t } = useTranslation();

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    const index = statusSteps.indexOf(status);
    const progress = ((index + 1) / statusSteps.length) * 100;
    
    if (status === 'completed') {
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> {t('common.success')}</Badge>;
    }
    if (index >= 4) {
      return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> {Math.round(progress)}%</Badge>;
    }
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> {Math.round(progress)}%</Badge>;
  };

  const getDocumentStats = () => {
    const docs = student.documents || [];
    const approved = docs.filter(d => d.status === 'approved').length;
    const pending = docs.filter(d => d.status === 'uploaded' || d.status === 'pending').length;
    const rejected = docs.filter(d => d.status === 'rejected').length;
    return { total: docs.length, approved, pending, rejected };
  };

  const getUniversityName = (university?: Tables<'universities'>) => {
    if (!university) return '';
    const nameKey = `name_${currentLang}` as keyof Tables<'universities'>;
    return (university[nameKey] as string) || university.name_uz || '';
  };

  const docStats = getDocumentStats();
  const latestApp = student.applications?.[0];
  const appProgress = latestApp ? ((statusSteps.indexOf(latestApp.status) + 1) / statusSteps.length) * 100 : 0;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect?.(student)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={student.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(student.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{student.full_name || t('common.name')}</CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                {student.applications?.length || 0} {t('navigation.applications').toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {student.contract_date && (() => {
              const plan = normalizePlanName(student.payment_plan);
              const planStyles: Record<string, string> = {
                standart: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                premium: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
                no_risk: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                free: 'bg-muted text-muted-foreground',
              };
              const planLabels: Record<string, string> = {
                standart: 'Standart',
                premium: 'Premium',
                no_risk: 'No Risk',
                free: 'Free',
              };
              return (
                <Badge className={`gap-1 ${planStyles[plan] || planStyles.free}`}>
                  <ScrollText className="h-3 w-3" />
                  {t('student.contracted')} {planLabels[plan] ? ` · ${planLabels[plan]}` : ''}
                </Badge>
              );
            })()}
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Contact Info */}
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {student.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {student.phone}
            </span>
          )}
        </div>

        {/* Latest Application */}
        {latestApp && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate flex-1">
                {getUniversityName(latestApp.university)}
              </span>
              {getStatusBadge(latestApp.status)}
            </div>
            <Progress value={appProgress} className="h-1.5" />
          </div>
        )}

        {/* Document Stats */}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <FileText className="h-4 w-4" />
            {t('navigation.documents')}
          </span>
          <div className="flex items-center gap-2">
            {docStats.approved > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                {docStats.approved}
              </span>
            )}
            {docStats.pending > 0 && (
              <span className="flex items-center gap-1 text-yellow-600">
                <Clock className="h-3 w-3" />
                {docStats.pending}
              </span>
            )}
            {docStats.rejected > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                {docStats.rejected}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
