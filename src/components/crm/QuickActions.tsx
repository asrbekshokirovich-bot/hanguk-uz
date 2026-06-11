import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  FileText, 
  Phone, 
  MessageSquare,
  GraduationCap,
  ClipboardList,
  Calendar,
  TrendingUp
} from 'lucide-react';

interface QuickActionsProps {
  isAdmin: boolean;
  isCallOperator: boolean;
  isDocumentHandler: boolean;
  onAction?: (action: string) => void;
}

export function QuickActions({ isAdmin, isCallOperator, isDocumentHandler, onAction }: QuickActionsProps) {
  const { t } = useTranslation();

  const actions = [
    {
      id: 'add-student',
      icon: UserPlus,
      label: t('crm.addStudent'),
      color: 'bg-info',
      visible: isAdmin,
    },
    {
      id: 'review-documents',
      icon: FileText,
      label: t('navigation.documents'),
      color: 'bg-success',
      visible: isDocumentHandler,
    },
    {
      id: 'make-call',
      icon: Phone,
      label: t('common.phone'),
      color: 'bg-primary',
      visible: isCallOperator,
    },
    {
      id: 'messages',
      icon: MessageSquare,
      label: t('navigation.messages'),
      color: 'bg-warning',
      visible: true,
    },
    {
      id: 'universities',
      icon: GraduationCap,
      label: t('navigation.universities'),
      color: 'bg-primary',
      visible: isAdmin,
    },
    {
      id: 'tasks',
      icon: ClipboardList,
      label: t('navigation.tasks'),
      color: 'bg-warning',
      visible: true,
    },
    {
      id: 'calendar',
      icon: Calendar,
      label: t('navigation.calendar'),
      color: 'bg-primary',
      visible: true,
    },
    {
      id: 'reports',
      icon: TrendingUp,
      label: t('navigation.reports'),
      color: 'bg-info',
      visible: isAdmin,
    },
  ].filter(action => action.visible);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('crm.quickActions')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => onAction?.(action.id)}
            >
              <div className={`p-2 rounded-full ${action.color} text-white`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-xs text-center">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
