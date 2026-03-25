import { supabase } from '@/integrations/supabase/client';

interface Worker {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

interface Person {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  description: string;
  category: string;
  date: string;
  scheduled_date?: string | null;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  assigned_to?: { id: string; name: string };
}

type EntityType = 'workers' | 'transactions' | 'tasks' | 'people';

export function useCommandCenterSync() {
  const syncToCommandCenter = async (
    entityType: EntityType,
    data: Worker[] | Transaction[] | Task[] | Person[]
  ): Promise<boolean> => {
    try {
      console.log(`Syncing ${entityType} to Command Center:`, data);

      const { data: response, error } = await supabase.functions.invoke('sync-to-command-center', {
        body: {
          entity_type: entityType,
          data: data,
        },
      });

      if (error) {
        console.error('Error syncing to Command Center:', error);
        return false;
      }

      console.log('Sync response:', response);
      return response?.success === true;
    } catch (error) {
      console.error('Failed to sync to Command Center:', error);
      return false;
    }
  };

  const syncWorker = async (worker: Worker): Promise<boolean> => {
    return syncToCommandCenter('workers', [worker]);
  };

  const syncWorkers = async (workers: Worker[]): Promise<boolean> => {
    return syncToCommandCenter('workers', workers);
  };

  const syncPeople = async (people: Person[]): Promise<boolean> => {
    return syncToCommandCenter('people', people);
  };

  const syncTransaction = async (transaction: Transaction): Promise<boolean> => {
    return syncToCommandCenter('transactions', [transaction]);
  };

  const syncTransactions = async (transactions: Transaction[]): Promise<boolean> => {
    return syncToCommandCenter('transactions', transactions);
  };

  const syncTask = async (task: Task): Promise<boolean> => {
    return syncToCommandCenter('tasks', [task]);
  };

  const syncTasks = async (tasks: Task[]): Promise<boolean> => {
    return syncToCommandCenter('tasks', tasks);
  };

  return {
    syncToCommandCenter,
    syncWorker,
    syncWorkers,
    syncPeople,
    syncTransaction,
    syncTransactions,
    syncTask,
    syncTasks,
  };
}
