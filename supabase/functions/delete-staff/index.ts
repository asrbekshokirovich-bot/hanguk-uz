import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to verify they're authenticated
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get("SUPABASE_ANON_KEY"))!;
    const supabaseServiceKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if requesting user is an owner
    const { data: ownerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "owner")
      .single();

    if (!ownerRole) {
      return new Response(JSON.stringify({ error: "Only owners can delete staff accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id: targetUserId } = await req.json();

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (targetUserId === requestingUser.id) {
      return new Response(JSON.stringify({ error: "You cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if target user is an owner (owners cannot be deleted)
    const { data: targetOwnerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("role", "owner")
      .single();

    if (targetOwnerRole) {
      return new Response(JSON.stringify({ error: "Owner accounts cannot be deleted" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up orphan data before deleting the user
    // Set assigned_to/staff_id to null for related records
    await Promise.all([
      adminClient.from("tasks").update({ assigned_to: null }).eq("assigned_to", targetUserId),
      adminClient.from("calls").update({ staff_id: null }).eq("staff_id", targetUserId),
      adminClient.from("messages").update({ assigned_to: null }).eq("assigned_to", targetUserId),
      adminClient.from("messages").update({ replied_by: null }).eq("replied_by", targetUserId),
      adminClient.from("staff_bonuses").update({ staff_user_id: null }).eq("staff_user_id", targetUserId),
    ]);

    // Delete user roles first
    const { error: rolesError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId);

    if (rolesError) {
      console.error("Error deleting roles:", rolesError);
    }

    // Delete staff presence
    await adminClient
      .from("staff_presence")
      .delete()
      .eq("user_id", targetUserId);

    // Delete the profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("user_id", targetUserId);

    if (profileError) {
      console.error("Error deleting profile:", profileError);
    }

    // Delete the auth user
    const { error: authError } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (authError) {
      console.error("Error deleting auth user:", authError);
      return new Response(JSON.stringify({ error: "Failed to delete user account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in delete-staff function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
