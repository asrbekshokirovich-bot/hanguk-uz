import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  Users,
  GraduationCap,
  FileText,
  Phone,
  MessageSquare,
  ClipboardList,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { AIInsightsPanel } from '@/components/crm/AIInsightsPanel';
import { UzbekistanRegionalMap } from '@/components/crm/UzbekistanRegionalMap';
import { format } from 'date-fns';

interface CRMDashboardProps {
  isAdmin: boolean;
  isOwner: boolean;
  isCallOperator: boolean;
  isDocumentHandler: boolean;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const STATUS_COLORS: Record<string, string> = {
  documents_collection: 'hsl(var(--chart-1))',
  under_review: 'hsl(var(--chart-2))',
  submitted: 'hsl(var(--chart-3))',
  interview: 'hsl(var(--chart-4))',
  completed: 'hsl(var(--success))',
  rejected: 'hsl(var(--destructive))',
};

export function CRMDashboard({ isAdmin, isOwner, isCallOperator, isDocumentHandler }: CRMDashboardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { stats, loading } = useDashboardStats();
  const { toast } = useToast();
  const [isCleaning, setIsCleaning] = useState(false);

  const handleCleanupSuggestions = async () => {
    setIsCleaning(true);
    try {
      const { data: suggestions, error: sugErr } = await supabase.from('student_suggestions').select('id, student_id, university_id');
      if (sugErr) throw sugErr;

      const { data: applications, error: appErr } = await supabase.from('applications').select('student_id, university_id');
      if (appErr) throw appErr;

      const overlaps = suggestions.filter(sug => 
        applications.some(app => app.student_id === sug.student_id && app.university_id === sug.university_id)
      );

      if (overlaps.length === 0) {
        toast({ title: "System Clean", description: "No hallucinated suggestions found." });
        return;
      }

      for (const sug of overlaps) {
        await supabase.from('student_suggestions').delete().eq('id', sug.id);
      }

      toast({ 
        title: "Cleanup Complete", 
        description: `Successfully isolated and removed ${overlaps.length} hallucinated suggestions.` 
      });
    } catch (err: any) {
      toast({ title: "Cleanup Failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsCleaning(false);
    }
  };

  const quickLinks = [
    {
      title: t('navigation.students'),
      icon: Users,
      url: '/crm',
      color: 'bg-blue-500',
      count: stats.totalStudents,
      visible: true,
    },
    {
      title: t('navigation.applications'),
      icon: GraduationCap,
      url: '/crm',
      color: 'bg-green-500',
      count: stats.activeApplications,
      label: 'Active',
      visible: true,
    },
    {
      title: t('navigation.documents'),
      icon: FileText,
      url: '/crm',
      color: 'bg-yellow-500',
      count: stats.pendingDocuments,
      label: 'Pending',
      visible: true,
    },
    {
      title: t('navigation.messages'),
      icon: MessageSquare,
      url: '/crm/messages',
      color: 'bg-purple-500',
      count: stats.unreadMessages,
      label: 'Unread',
      visible: true,
    },
    {
      title: t('common.phone'),
      icon: Phone,
      url: '/crm/calls',
      color: 'bg-orange-500',
      count: stats.totalCalls,
      label: 'Total',
      visible: true,
    },
    {
      title: t('navigation.tasks'),
      icon: ClipboardList,
      url: '/crm/tasks',
      color: 'bg-pink-500',
      count: stats.pendingTasks,
      label: 'Pending',
      visible: true,
    },
    {
      title: t('navigation.payments'),
      icon: DollarSign,
      url: '/crm/finance',
      color: 'bg-emerald-500',
      count: stats.pendingPayments,
      label: 'Pending',
      visible: isOwner, // Only owners can see payments
    },
    {
      title: t('navigation.universities'),
      icon: GraduationCap,
      url: '/crm/universities',
      color: 'bg-indigo-500',
      visible: true,
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'application':
        return <GraduationCap className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'payment':
        return <DollarSign className="h-4 w-4" />;
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'task':
        return <ClipboardList className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('navigation.dashboard')}</h2>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="destructive" onClick={handleCleanupSuggestions} disabled={isCleaning}>
              {isCleaning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Clean Hallucinations
            </Button>
          )}
          <Button onClick={() => navigate('/crm/tasks')}>
            <ClipboardList className="h-4 w-4 mr-2" />
            {t('navigation.tasks')}
          </Button>
        </div>
      </div>

      {/* AI Insights Panel - Prominent placement at top */}
      <AIInsightsPanel />

      {/* Uzbekistan Regional Analytics Map */}
      <UzbekistanRegionalMap />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-chart-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('navigation.students')}</p>
                <p className="text-3xl font-bold">{stats.totalStudents}</p>
              </div>
              <div className="p-3 bg-chart-1/10 rounded-full">
                <Users className="h-6 w-6 text-chart-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-chart-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Apps</p>
                <p className="text-3xl font-bold">{stats.activeApplications}</p>
              </div>
              <div className="p-3 bg-chart-2/10 rounded-full">
                <GraduationCap className="h-6 w-6 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('common.success')}</p>
                <p className="text-3xl font-bold">{stats.completedApplications}</p>
              </div>
              <div className="p-3 bg-success/10 rounded-full">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('student.pending')} Tasks</p>
                <p className="text-3xl font-bold">{stats.pendingTasks}</p>
              </div>
              <div className="p-3 bg-warning/10 rounded-full">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickLinks
              .filter((link) => link.visible)
              .map((link) => (
                <Button
                  key={link.url + link.title}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-accent/10 hover:border-accent"
                  onClick={() => navigate(link.url)}
                >
                  <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                    <link.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">{link.title}</span>
                  {link.count !== undefined && (
                    <Badge variant="highlight" className="text-xs">
                      {link.count} {link.label}
                    </Badge>
                  )}
                </Button>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Applications by Month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Applications Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.applicationsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Applications by Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Applications by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.applicationsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => `${status}: ${count}`}
                    labelLine={false}
                  >
                    {stats.applicationsByStatus.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Calls by Day */}
        {(
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Calls This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.callsByDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="incoming" fill="hsl(var(--chart-2))" name="Incoming" />
                    <Bar dataKey="outgoing" fill="hsl(var(--chart-3))" name="Outgoing" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tasks by Priority */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Tasks by Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.tasksByPriority} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="priority" type="category" className="text-xs" width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity - show if not call operator or in place of calls chart */}
        {false && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {stats.recentActivity.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No recent activity
                    </p>
                  ) : (
                    stats.recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="p-2 rounded-full bg-background">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{activity.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.description}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(activity.timestamp), 'MMM d')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Module Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              variant="ghost"
              className="justify-between h-auto py-3"
              onClick={() => navigate('/crm/messages')}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                <span>{t('navigation.messages')}</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              className="justify-between h-auto py-3"
              onClick={() => navigate('/crm/tasks')}
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-pink-500" />
                <span>{t('navigation.tasks')}</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>

            {(
              <Button
                variant="ghost"
                className="justify-between h-auto py-3"
                onClick={() => navigate('/crm/calls')}
              >
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-orange-500" />
                  <span>Call Logs</span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {isOwner && (
              <Button
                variant="ghost"
                className="justify-between h-auto py-3"
                onClick={() => navigate('/crm/payments')}
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  <span>{t('navigation.payments')}</span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              className="justify-between h-auto py-3"
              onClick={() => navigate('/crm/universities')}
            >
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-indigo-500" />
                <span>{t('navigation.universities')}</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
