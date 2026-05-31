import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface WebhookPayload {
  entity_type: 'task' | 'transaction' | 'worker';
  action: 'created' | 'updated' | 'deleted';
  data: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('BCC_API_KEY');
    const authHeader = req.headers.get('x-api-key');
    
    console.log('Webhook received, verifying API key...');
    
    if (!API_KEY || authHeader !== API_KEY) {
      console.error('Unauthorized webhook attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WebhookPayload = await req.json();
    const { entity_type, action, data } = payload;

    console.log(`Received webhook: ${entity_type} - ${action}`, JSON.stringify(data, null, 2));

    switch (entity_type) {
      case 'task':
        await handleTaskUpdate(supabase, action, data);
        break;
      case 'transaction':
        await handleTransactionUpdate(supabase, action, data);
        break;
      case 'worker':
        await handleWorkerUpdate(supabase, action, data);
        break;
      default:
        console.log(`Unknown entity type: ${entity_type}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function handleTaskUpdate(supabase: any, action: string, data: Record<string, unknown>) {
  const commandCenterId = data.id as string;
  console.log(`Processing task ${action}: ${commandCenterId}`);

  // Handle deletion
  if (action === 'deleted') {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('external_task_id', commandCenterId)
      .eq('source', 'command-center');
    
    if (error) {
      console.error('Error deleting task:', error);
    } else {
      console.log('Task deleted successfully');
    }
    return;
  }

  // Find assigned profile by external_crm_id (which is the profile's user_id)
  let assignedTo: string | null = null;
  const assignedWorker = data.assigned_worker as { external_crm_id?: string } | undefined;
  
  if (assignedWorker?.external_crm_id) {
    console.log('Looking up worker by external_crm_id:', assignedWorker.external_crm_id);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', assignedWorker.external_crm_id)
      .maybeSingle();
    
    if (error) {
      console.error('Error finding profile:', error);
    } else if (profile) {
      assignedTo = profile.user_id;
      console.log('Found assigned profile:', assignedTo);
    } else {
      console.log('No profile found for external_crm_id');
    }
  }

  // Get a fallback created_by (first owner or admin)
  let createdBy = assignedTo;
  if (!createdBy) {
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle();
    
    createdBy = adminRole?.user_id || null;
    console.log('Using fallback created_by:', createdBy);
  }

  if (!createdBy) {
    console.error('No valid created_by user found, cannot create task');
    return;
  }

  // Check if task already exists by external_task_id
  const { data: existingTask } = await supabase
    .from('tasks')
    .select('id')
    .eq('external_task_id', commandCenterId)
    .maybeSingle();

  const taskData = {
    title: data.title as string,
    description: (data.description as string) || null,
    status: mapTaskStatus(data.status as string),
    priority: mapPriority(data.priority as string),
    due_date: (data.due_date as string) || null,
    assigned_to: assignedTo,
    updated_at: new Date().toISOString(),
  };

  if (existingTask) {
    // Update existing task
    console.log('Updating existing task:', existingTask.id);
    const { error } = await supabase
      .from('tasks')
      .update(taskData)
      .eq('id', existingTask.id);

    if (error) {
      console.error('Error updating task:', error);
    } else {
      console.log('Task updated successfully');
    }
  } else {
    // Create new task from Command Center
    console.log('Creating new task from Command Center');
    const { error } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        external_task_id: commandCenterId,
        source: 'command-center',
        created_by: createdBy,
      });

    if (error) {
      console.error('Error creating task:', error);
    } else {
      console.log('Task created successfully');
    }
  }
}

// deno-lint-ignore no-explicit-any
async function handleTransactionUpdate(supabase: any, action: string, data: Record<string, unknown>) {
  console.log(`Processing transaction ${action}:`, data);
  
  // Handle income transactions that might relate to student payments
  if (data.type === 'income' && data.person_id) {
    const studentId = data.person_id as string;
    const amount = data.amount as number;
    
    const { error } = await supabase
      .from('payments')
      .update({ 
        paid_amount: amount,
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('student_id', studentId)
      .eq('status', 'pending');
    
    if (error) {
      console.error('Error updating payment:', error);
    }
  }
}

// deno-lint-ignore no-explicit-any
async function handleWorkerUpdate(supabase: any, action: string, data: Record<string, unknown>) {
  console.log(`Processing worker ${action}:`, data);
  
  const externalCrmId = data.external_crm_id as string;
  
  if (!externalCrmId) {
    console.log('No external_crm_id, skipping worker update');
    return;
  }

  if (action === 'updated') {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: data.name as string,
        phone: (data.phone as string) || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', externalCrmId);

    if (error) {
      console.error('Error updating profile:', error);
    } else {
      console.log('Profile updated successfully');
    }
  }
}

function mapTaskStatus(status: string): string {
  const map: Record<string, string> = {
    'todo': 'todo',
    'in_progress': 'in_progress',
    'done': 'done',
    'completed': 'done',
  };
  return map[status] || 'todo';
}

function mapPriority(priority: string): string {
  const map: Record<string, string> = {
    'low': 'low',
    'medium': 'normal',
    'normal': 'normal',
    'high': 'high',
    'urgent': 'urgent',
  };
  return map[priority] || 'normal';
}
