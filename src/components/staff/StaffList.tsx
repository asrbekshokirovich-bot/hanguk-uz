import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { StaffMember } from '@/hooks/useStaffManagement';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  User,
  ShieldCheck,
  Phone as PhoneIcon,
  Headphones,
  FileCheck,
  GraduationCap,
  Crown,
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type AppRole = Database['public']['Enums']['app_role'];

interface StaffListProps {
  staff: StaffMember[];
  selectedStaff: StaffMember | null;
  onSelectStaff: (staff: StaffMember) => void;
}

const ROLE_CONFIG: Record<AppRole, { label: string; icon: React.ReactNode; color: string }> = {
  owner: { label: 'Owner', icon: <Crown className="h-3 w-3" />, color: 'bg-warning' },
  admin: { label: 'Admin', icon: <ShieldCheck className="h-3 w-3" />, color: 'bg-primary' },
  call_operator: { label: 'Call Operator', icon: <Headphones className="h-3 w-3" />, color: 'bg-info' },
  document_handler: { label: 'Doc Handler', icon: <FileCheck className="h-3 w-3" />, color: 'bg-success' },
  university_staff: { label: 'Uni Staff', icon: <GraduationCap className="h-3 w-3" />, color: 'bg-info' },
};

export function StaffList({ staff, selectedStaff, onSelectStaff }: StaffListProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all');

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      member.phone?.includes(search);

    const matchesRole = roleFilter === 'all' || member.roles.includes(roleFilter);

    return matchesSearch && matchesRole;
  });

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={roleFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('all')}
          >
            All
          </Button>
          {(Object.keys(ROLE_CONFIG) as AppRole[]).map((role) => (
            <Button
              key={role}
              variant={roleFilter === role ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter(role)}
              className="gap-1"
            >
              {ROLE_CONFIG[role].icon}
              {ROLE_CONFIG[role].label}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredStaff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No staff members found</p>
            </div>
          ) : (
            filteredStaff.map((member) => {
              const isCurrentUser = member.user_id === user?.id;

              return (
                <Card
                  key={member.id}
                  className={cn(
                    'cursor-pointer transition-all hover:bg-accent/50',
                    selectedStaff?.id === member.id && 'border-primary bg-accent'
                  )}
                  onClick={() => onSelectStaff(member)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {member.full_name || 'Unnamed User'}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground ml-2">(You)</span>
                          )}
                        </p>
                        {member.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <PhoneIcon className="h-3 w-3" />
                            {member.phone}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {member.roles.map((role) => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className={`text-xs text-white ${ROLE_CONFIG[role].color}`}
                            >
                              {ROLE_CONFIG[role].icon}
                              <span className="ml-1">{ROLE_CONFIG[role].label}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Joined {format(new Date(member.created_at), 'MMM d, yyyy')}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
