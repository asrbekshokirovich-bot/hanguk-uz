import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    if (req.method === "POST") {
      const update = await req.json();
      console.log("Received Telegram update:", JSON.stringify(update));

      // Handle incoming message
      if (update.message) {
        const message = update.message;
        const chatId = message.chat.id.toString();
        const senderId = message.from.id.toString();
        const senderName = [message.from.first_name, message.from.last_name]
          .filter(Boolean)
          .join(" ");
        const content = message.text || "[Media message]";

        // Atomic upsert with increment (fixes race condition)
        const { error: threadError } = await supabase.rpc('increment_thread_unread', {
          p_source: 'telegram',
          p_sender_id: chatId,
          p_sender_name: senderName,
        });

        if (threadError) {
          console.error("Thread upsert error:", threadError);
        }

        // Insert message
        const { error: msgError } = await supabase.from("messages").insert({
          source: "telegram",
          external_id: message.message_id.toString(),
          sender_id: chatId,
          sender_name: senderName,
          content: content,
          message_type: message.photo ? "image" : message.voice ? "voice" : "text",
          direction: "incoming",
          status: "unread",
          metadata: {
            telegram_chat_id: chatId,
            telegram_message_id: message.message_id,
            telegram_user_id: senderId,
          },
        });

        if (msgError) {
          console.error("Message insert error:", msgError);
          throw msgError;
        }

        console.log("Message saved successfully");
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET request - return webhook info
    return new Response(
      JSON.stringify({
        message: "Telegram webhook endpoint",
        configured: !!TELEGRAM_BOT_TOKEN,
        setup_instructions: TELEGRAM_BOT_TOKEN
          ? "Webhook is configured"
          : "Set TELEGRAM_BOT_TOKEN secret and configure webhook URL in Telegram BotFather",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
