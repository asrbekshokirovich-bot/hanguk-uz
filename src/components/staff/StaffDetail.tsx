import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { StaffMember } from '@/hooks/useStaffManagement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  User,
  Phone,
  Calendar,
  Shield,
  ShieldCheck,
  Headphones,
  FileCheck,
  GraduationCap,
  Crown,
  Plus,
  X,
  Save,
  Edit,
  Trash2,
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { IntercomButton } from '@/components/intercom/IntercomButton';
import { useIntercom } from '@/components/intercom/IntercomProvider';

type AppRole = Database['public']['Enums']['app_role'];

interface StaffDetailProps {
  staff: StaffMember;
  onAddRole: (userId: string, role: AppRole) => Promise<boolean>;
  onRemoveRole: (userId: string, role: AppRole) => Promise<boolean>;
  onUpdateProfile: (userId: string, updates: { full_name?: string; phone?: string }) => Promise<boolean>;
  onDeleteAccount: (userId: string) => Promise<boolean>;
  isOwner: boolean;
  onStaffDeleted?: () => void;
}

const ROLE_CONFIG: Record<AppRole, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  owner: {
    label: 'Owner',
    icon: <Crown className="h-4 w-4" />,
    color: 'bg-warning',
    description: 'Full system access, can manage all users and settings',
  },
  admin: {
    label: 'Admin',
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'bg-primary',
    description: 'Manage staff, payments, universities, and view all data',
  },
  call_operator: {
    label: 'Call Operator',
    icon: <Headphones className="h-4 w-4" />,
    color: 'bg-info',
    description: 'Handle calls, messages, and student communications',
  },
  document_handler: {
    label: 'Document Handler',
    icon: <FileCheck className="h-4 w-4" />,
    color: 'bg-success',
    description: 'Review and manage student documents and applications',
  },
  university_staff: {
    label: 'University Staff',
    icon: <GraduationCap className="h-4 w-4" />,
    color: 'bg-info',
    description: 'University representative with access to their university portal',
  },
};

const ALL_ROLES: AppRole[] = ['owner', 'admin', 'call_operator', 'document_handler', 'university_staff'];

export function StaffDetail({
  staff,
  onAddRole,
  onRemoveRole,
  onUpdateProfile,
  onDeleteAccount,
  isOwner,
  onStaffDeleted,
}: StaffDetailProps) {
  const { t } = useTranslation();
  const { startCall, callState, endCall } = useIntercom();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: staff.full_name || '',
    phone: staff.phone || '',
  });

  // Issue 10: University assignment management
  const [universities, setUniversities] = useState<Array<{ id: string; name_en: string | null; name_ko: string }>>([]);
  const [currentAssignment, setCurrentAssignment] = useState<{ id: string; institution_id: string; title: string | null } | null>(null);
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assigningSaving, setAssigningSaving] = useState(false);

  const isUniversityStaff = staff.roles.includes('university_staff');

  useEffect(() => {
    if (!isUniversityStaff) return;
    const fetchAssignmentData = async () => {
      // Phase 3R-B: university_staff_assignments was dropped 2026-05-10.
      // Until a replacement table is introduced, we still surface the
      // institutions list for selection but no assignment can be persisted.
      const { data: unis } = await supabase
        .from('institutions')
        .select('id, name_en, name_ko')
        .order('name_ko');
      setUniversities(unis || []);
      setCurrentAssignment(null);
    };
    fetchAssignmentData();
  }, [staff.user_id, isUniversityStaff]);

  const handleSaveAssignment = async () => {
    // Phase 3R-B: university_staff_assignments dropped 2026-05-10.
    // Save is a no-op until the replacement table lands.
    console.warn('university_staff_assignments was retired on 2026-05-10. Save is a no-op.');
    setAssigningSaving(false);
  };

  const handleStartCall = () => {
    startCall({
      userId: staff.user_id,
      name: staff.full_name || 'Unknown',
      avatar: staff.avatar_url || undefined,
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await onUpdateProfile(staff.user_id, {
      full_name: formData.full_name || undefined,
      phone: formData.phone || undefined,
    });
    setSaving(false);
    if (success) {
      setEditing(false);
    }
  };

  const handleAddRole = async (role: AppRole) => {
    await onAddRole(staff.user_id, role);
  };

  const handleRemoveRole = async (role: AppRole) => {
    await onRemoveRole(staff.user_id, role);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const success = await onDeleteAccount(staff.user_id);
    setDeleting(false);
    if (success && onStaffDeleted) {
      onStaffDeleted();
    }
  };

  const availableRoles = ALL_ROLES.filter((role) => !staff.roles.includes(role));
  const isStaffOwner = staff.roles.includes('owner');

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={staff.avatar_url || undefined} />
              <AvatarFallback className="text-lg">{getInitials(staff.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{staff.full_name || 'Unnamed User'}</h2>
              <p className="text-sm text-muted-foreground">Staff Member</p>
            </div>
          </div>
          {!editing ? (
            <div className="flex gap-2">
              <IntercomButton
                targetUserId={staff.user_id}
                targetUserName={staff.full_name || 'Unknown'}
                targetUserAvatar={staff.avatar_url || undefined}
                isCalling={callState.isCalling && callState.callee?.userId === staff.user_id}
                isActive={callState.isActive && callState.callee?.userId === staff.user_id}
                onStartCall={handleStartCall}
                onEndCall={endCall}
              />
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Profile Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{staff.full_name || 'Not set'}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </span>
                  <span className="font-medium">{staff.phone || 'Not set'}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Joined
                  </span>
                  <span className="font-medium">
                    {format(new Date(staff.created_at), 'MMMM d, yyyy')}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Current Roles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Current Roles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {staff.roles.length === 0 ? (
              <p className="text-muted-foreground text-sm">No roles assigned</p>
            ) : (
              staff.roles.map((role) => (
                <div
                  key={role}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${ROLE_CONFIG[role].color} text-white`}>
                      {ROLE_CONFIG[role].icon}
                    </div>
                    <div>
                      <p className="font-medium">{ROLE_CONFIG[role].label}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_CONFIG[role].description}
                      </p>
                    </div>
                  </div>
                  {isOwner && role !== 'owner' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Role</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove the {ROLE_CONFIG[role].label} role from
                            this user? They will lose access to associated features.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemoveRole(role)}>
                            Remove Role
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Add Roles */}
        {isOwner && availableRoles.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Role
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {availableRoles.map((role) => (
                <Button
                  key={role}
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => handleAddRole(role)}
                  disabled={role === 'owner' && isStaffOwner}
                >
                  <div className={`p-1.5 rounded ${ROLE_CONFIG[role].color} text-white`}>
                    {ROLE_CONFIG[role].icon}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{ROLE_CONFIG[role].label}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_CONFIG[role].description}
                    </p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* University Assignment - Issue 10 */}
        {isOwner && isUniversityStaff && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                University Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>University</Label>
                <Select value={selectedUniversityId} onValueChange={setSelectedUniversityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select university..." />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map(u => (
                      <SelectItem key={u.id} value={u.id}>{(u.name_ko ?? u.name_en ?? u.id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title / Position</Label>
                <Input value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} placeholder="e.g. Admissions Officer" />
              </div>
              <Button size="sm" onClick={handleSaveAssignment} disabled={assigningSaving || !selectedUniversityId}>
                <Save className="h-4 w-4 mr-2" />
                {currentAssignment ? 'Update Assignment' : 'Assign University'}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">User ID</span>
              <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                {staff.user_id.slice(0, 8)}...
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account - Only for owners, and cannot delete other owners */}
        {isOwner && !isStaffOwner && (
          <Card className="border-destructive/50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently remove this staff member and their access
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleting}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Staff Account</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to permanently delete{' '}
                        <strong>{staff.full_name || 'this staff member'}</strong>? This will:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Remove all their roles and permissions</li>
                          <li>Delete their profile and account</li>
                          <li>Prevent them from logging in</li>
                        </ul>
                        <p className="mt-2 font-medium">This action cannot be undone.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
