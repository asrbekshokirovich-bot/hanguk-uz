import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ApiError } from "./error-handler.ts";
import { publishableKey } from "./keys.ts";
import { isAnonymousAccount } from "./hanguk-ish.ts";

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader) {
    throw new ApiError(401, "Missing authorization token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = publishableKey();
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new ApiError(500, "Supabase environment variables missing");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, error?.message || "Invalid or expired token");
  }
  // Hanguk Ish's anonymous accounts (P53): not hanguk.uz's people.
  if (isAnonymousAccount(user)) {
    throw new ApiError(403, "Forbidden");
  }

  return user;
}
