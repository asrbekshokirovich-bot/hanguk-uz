import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { z } from 'zod';
import { User, Lock, UserPlus } from 'lucide-react';

type AppRole = Database['public']['Enums']['app_role'];

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const usernameSchema = z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/);
const passwordSchema = z.string().min(6);

const ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'owner', label: 'Owner', description: 'Full system access including finances' },
  { value: 'admin', label: 'Admin', description: 'Full management access' },
  { value: 'call_operator', label: 'Call Operator', description: 'Handle communications' },
  { value: 'document_handler', label: 'Document Handler', description: 'Manage documents' },
];

export function CreateAccountDialog({ open, onOpenChange, onSuccess }: CreateAccountDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { createStaffAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  const handleRoleToggle = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setSelectedRoles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!usernameSchema.safeParse(username).success) {
      toast({
        title: 'Error',
        description: 'Username must be 3-20 characters (letters, numbers, underscores)',
        variant: 'destructive',
      });
      return;
    }

    if (!passwordSchema.safeParse(password).success) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (!fullName.trim()) {
      toast({
        title: 'Error',
        description: 'Full name is required',
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

    const { error, userId } = await createStaffAccount(username, password, fullName, selectedRoles);

    if (error) {
      setLoading(false);
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        toast({
          title: 'Error',
          description: 'Username already exists',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
      return;
    }

    setLoading(false);

    toast({
      title: 'Success',
      description: `Account "${username}" created successfully`,
    });

    resetForm();
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create Staff Account
          </DialogTitle>
          <DialogDescription>
            Create a new staff account with username and password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-fullname">Full Name</Label>
            <Input
              id="new-fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Staff member name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-username">Username</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="staffmember"
                className="pl-9"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Letters, numbers, and underscores only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-confirm">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign Roles</Label>
            <div className="space-y-3">
              {ROLES.map((role) => (
                <label
                  key={role.value}
                  htmlFor={`role-${role.value}`}
                  className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    id={`role-${role.value}`}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
