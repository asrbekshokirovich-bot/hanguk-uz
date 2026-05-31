import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MentionNotificationRequest {
  mentionedUserId: string;
  mentionedBy: string;
  mentionerName: string;
  contextType: string;
  contextId: string;
  contentPreview: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mentionedUserId, mentionedBy, mentionerName, contextType, contextId, contentPreview }: MentionNotificationRequest = await req.json();

    // Get push tokens for the mentioned user
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", mentionedUserId);

    if (tokensError) {
      console.error("Error fetching push tokens:", tokensError);
    }

    // Create in-app notification record
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: mentionedUserId,
        title: `${mentionerName} mentioned you`,
        body: contentPreview || "You were mentioned in a conversation",
        notification_type: "mention",
        data: {
          context_type: contextType,
          context_id: contextId,
          mentioned_by: mentionedBy,
        },
      });

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
    }

    // If there are push tokens, send push notifications
    // Note: This is a placeholder - actual push notification sending would require
    // FCM/APNs credentials and implementation
    if (tokens && tokens.length > 0) {
      console.log(`Would send push to ${tokens.length} devices for user ${mentionedUserId}`);
      // TODO: Implement FCM/APNs push notification sending when credentials are available
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
