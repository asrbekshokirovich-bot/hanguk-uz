import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserRole } from '@/hooks/useUserRole';
import { useStaffManagement, StaffMember } from '@/hooks/useStaffManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StaffList } from '@/components/staff/StaffList';
import { StaffDetail } from '@/components/staff/StaffDetail';
import { AddStaffDialog } from '@/components/staff/AddStaffDialog';
import { CreateAccountDialog } from '@/components/staff/CreateAccountDialog';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Headphones,
  FileCheck,
} from 'lucide-react';

export default function StaffContent() {
  const { t } = useTranslation();
  const { hasRole } = useUserRole();
  const { staff, loading: staffLoading, addRole, removeRole, updateStaffProfile, deleteStaffAccount, refetch } = useStaffManagement();

  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [createAccountDialogOpen, setCreateAccountDialogOpen] = useState(false);

  const isOwner = hasRole('owner');

  // Calculate stats
  const totalStaff = staff.length;
  const admins = staff.filter((s) => s.roles.includes('admin') || s.roles.includes('owner')).length;
  const callOperators = staff.filter((s) => s.roles.includes('call_operator')).length;
  const docHandlers = staff.filter((s) => s.roles.includes('document_handler')).length;

  return (
    <div className="space-y-6">
      {/* Header Actions - Only owners can create staff accounts */}
      {isOwner && (
        <div className="flex justify-end gap-2">
          <Button onClick={() => setCreateAccountDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Create Account
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{totalStaff}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{admins}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Call Operators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{callOperators}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Doc Handlers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{docHandlers}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 overflow-hidden">
          <StaffList
            staff={staff}
            selectedStaff={selectedStaff}
            onSelectStaff={setSelectedStaff}
          />
        </Card>

        <Card className="md:col-span-2">
          {selectedStaff ? (
            <StaffDetail
              staff={selectedStaff}
              onAddRole={addRole}
              onRemoveRole={removeRole}
              onUpdateProfile={updateStaffProfile}
              onDeleteAccount={deleteStaffAccount}
              isOwner={isOwner}
              onStaffDeleted={() => setSelectedStaff(null)}
            />
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-center">
              <div>
                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select a Staff Member</h3>
                <p className="text-muted-foreground">
                  Choose a staff member from the list to view and manage their roles
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Add Staff Dialog */}
      <AddStaffDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={refetch}
      />

      {/* Create Account Dialog */}
      <CreateAccountDialog
        open={createAccountDialogOpen}
        onOpenChange={setCreateAccountDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
}
