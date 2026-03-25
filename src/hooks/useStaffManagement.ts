import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { useCommandCenterSync } from '@/hooks/useCommandCenterSync';

type AppRole = Database['public']['Enums']['app_role'];

export interface StaffMember {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: AppRole[];
}

export function useStaffManagement() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSyncedOnInit, setHasSyncedOnInit] = useState(false);
  const { syncWorkers } = useCommandCenterSync();

  const syncStaffToCommandCenter = async (staffList: StaffMember[]) => {
    if (staffList.length === 0) return;
    
    // Command Center expects 'workers' entity type, not 'people'
    const workers = staffList.map(s => ({
      id: s.user_id,
      name: s.full_name || 'Unknown',
      email: s.full_name ? `${s.full_name.toLowerCase().replace(/\s+/g, '.')}@hanguk.uz` : `staff-${s.user_id.slice(0,8)}@hanguk.uz`,
      phone: s.phone || undefined,
      role: s.roles.includes('owner') ? 'owner' : 
            s.roles.includes('admin') ? 'admin' : 
            s.roles.join(', ') || 'staff',
    }));
    
    console.log('Syncing staff to Command Center:', workers);
    await syncWorkers(workers);
  };

  const fetchStaff = async (triggerSync = false) => {
    setLoading(true);

    // Get all users who have roles
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      setLoading(false);
      return;
    }

    // Group roles by user
    const userRoles: Record<string, AppRole[]> = {};
    rolesData?.forEach((r) => {
      if (!userRoles[r.user_id]) {
        userRoles[r.user_id] = [];
      }
      userRoles[r.user_id].push(r.role);
    });

    const userIds = Object.keys(userRoles);

    if (userIds.length === 0) {
      setStaff([]);
      setLoading(false);
      return;
    }

    // Get profiles for these users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoading(false);
      return;
    }

    const staffList: StaffMember[] = (profiles || []).map((p) => ({
      id: p.id,
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      roles: userRoles[p.user_id] || [],
    }));

    setStaff(staffList);
    
    // Sync all staff to Command Center on init or when explicitly requested
    if ((triggerSync || !hasSyncedOnInit) && staffList.length > 0) {
      setHasSyncedOnInit(true);
      syncStaffToCommandCenter(staffList);
    }
    
    setLoading(false);
  };

  const addRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (error) {
      if (error.code === '23505') {
        toast({
          title: 'Info',
          description: 'User already has this role',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to add role',
          variant: 'destructive',
        });
      }
      return false;
    }

    toast({
      title: 'Success',
      description: 'Role added successfully',
    });

    await fetchStaff(true); // Trigger sync after role change
    return true;
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove role',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Success',
      description: 'Role removed successfully',
    });

    await fetchStaff(true); // Trigger sync after role change
    return true;
  };

  const updateStaffProfile = async (userId: string, updates: { full_name?: string; phone?: string }) => {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Success',
      description: 'Profile updated successfully',
    });

    await fetchStaff(true); // Trigger sync after profile update
    return true;
  };

  const deleteStaffAccount = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke('delete-staff', {
      body: { user_id: userId },
    });

    if (error || data?.error) {
      toast({
        title: 'Error',
        description: data?.error || 'Failed to delete staff account',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Success',
      description: 'Staff account deleted successfully',
    });

    await fetchStaff(true);
    return true;
  };

  // Search for users by email to add as staff
  const searchUserByEmail = async (email: string): Promise<{ user_id: string; email: string } | null> => {
    // We can't directly query auth.users, so we'll need to use an edge function
    // For now, return null - admin can add roles to existing users via their profile
    return null;
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Force sync all staff to Command Center
  const syncAllStaff = async () => {
    if (staff.length > 0) {
      await syncStaffToCommandCenter(staff);
    }
  };

  return {
    staff,
    loading,
    addRole,
    removeRole,
    updateStaffProfile,
    deleteStaffAccount,
    searchUserByEmail,
    refetch: () => fetchStaff(true), // Always sync when manually refetching
    syncAllStaff,
  };
}
