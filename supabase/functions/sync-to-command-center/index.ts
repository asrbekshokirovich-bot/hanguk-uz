import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SyncPayload {
  entity_type: 'workers' | 'transactions' | 'tasks' | 'people';
  data: unknown[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('BCC_API_KEY');
    const BUSINESS_ID = Deno.env.get('BCC_BUSINESS_ID');
    if (!API_KEY || !BUSINESS_ID) {
      console.error('Missing BCC_API_KEY or BCC_BUSINESS_ID environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Command Center expects business_id as a query parameter
    const WEBHOOK_URL = `https://hbgesutkaiakbptfzmky.supabase.co/functions/v1/crm-webhook?business_id=${BUSINESS_ID}`;

    const payload: SyncPayload = await req.json();
    const { entity_type, data } = payload;

    console.log(`Syncing ${entity_type} to Command Center:`, JSON.stringify(data).slice(0, 500));

    // Build payload with entity type as key (e.g., { workers: [...] })
    const webhookPayload: Record<string, unknown> = {};
    webhookPayload[entity_type] = data;

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(webhookPayload),
    });

    const responseText = await response.text();
    console.log(`Command Center response: ${response.status} - ${responseText}`);

    if (!response.ok) {
      console.error(`Failed to sync to Command Center: ${response.status} - ${responseText}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Command Center sync failed',
          status: response.status,
          details: responseText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Synced to Command Center' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing to Command Center:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
