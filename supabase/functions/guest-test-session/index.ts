// A session for a guest to take a university's Study Plan and interview
// tests without a client code (owner, 2026-10-21). Supabase's anonymous
// sign-in is off for the project, so this makes the same thing by hand: a
// confirmed user "guest-<uuid>@hanguk.local" with a random password, marked
// guest in app_metadata, whose credentials the app keeps on the phone and
// signs in with. The app does not count such a session as a client's (the
// application and documents stay locked), and handle_new_user gives it no
// profile, so it never shows in the CRM as a student.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const password = btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "").slice(0, 28) + "Aa1";
    const email = `guest-${crypto.randomUUID()}@hanguk.local`;
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { guest: true },
      user_metadata: { guest: true },
    });
    if (error) {
      console.error("createUser", error);
      return json({ error: "failed" }, 500);
    }
    return json({ email, password });
  } catch (e) {
    console.error(e);
    return json({ error: "failed" }, 500);
  }
});
