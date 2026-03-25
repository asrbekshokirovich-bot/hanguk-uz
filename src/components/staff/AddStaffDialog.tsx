import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { Tables } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AddStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full management access' },
  { value: 'call_operator', label: 'Call Operator', description: 'Handle communications' },
  { value: 'document_handler', label: 'Document Handler', description: 'Manage documents' },
];

export function AddStaffDialog({ open, onOpenChange, onSuccess }: AddStaffDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [existingUsers, setExistingUsers] = useState<Tables<'profiles'>[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    if (open) {
      fetchExistingUsers();
      setSelectedUserId('');
      setSelectedRoles([]);
    }
  }, [open]);

  const fetchExistingUsers = async () => {
    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    // Get users who already have roles
    const { data: existingRoles } = await supabase
      .from('user_roles')
      .select('user_id');

    const usersWithRoles = new Set(existingRoles?.map((r) => r.user_id) || []);

    // Filter to only show users without any roles
    const availableUsers = (profiles || []).filter((p) => !usersWithRoles.has(p.user_id));
    setExistingUsers(availableUsers);
  };

  const handleRoleToggle = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Error',
        description: 'Please select a user',
        variant: 'destructive',
      });
      return;
    }

    if (selectedRoles.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one role',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    // Add all selected roles
    const roleInserts = selectedRoles.map((role) => ({
      user_id: selectedUserId,
      role,
    }));

    const { error } = await supabase.from('user_roles').insert(roleInserts);

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add staff member',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Staff member added successfully',
    });

    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
          <DialogDescription>
            Select an existing user and assign them staff roles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                {existingUsers.length === 0 ? (
                  <SelectItem value="__no_users__" disabled>
                    No available users found
                  </SelectItem>
                ) : (
                  existingUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || 'Unnamed'} {user.phone && `(${user.phone})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only users without existing roles are shown
            </p>
          </div>

          <div className="space-y-2">
            <Label>Assign Roles</Label>
            <div className="space-y-3">
              {ROLES.map((role) => (
                <label
                  key={role.value}
                  htmlFor={`add-role-${role.value}`}
                  className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    id={`add-role-${role.value}`}
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => handleRoleToggle(role.value)}
                  />
                  <div className="space-y-1">
                    <span className="font-medium">
                      {role.label}
                    </span>
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedUserId || selectedRoles.length === 0}>
            {loading ? 'Adding...' : 'Add Staff Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
