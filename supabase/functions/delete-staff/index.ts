import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Faqat shu rollardan biri bor akkaunt "xodim" hisoblanadi va o'chirilishi mumkin.
// owner o'chirilmaydi; talaba va investor akkauntlari bu funksiya orqali o'chmaydi.
const STAFF_ROLES = ["admin", "call_operator", "document_handler", "university_staff"];

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Avtorizatsiya yo'q" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      return json({ error: "Avtorizatsiya yo'q" }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Faqat owner o'chira oladi
    const { data: ownerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerRole) {
      return json({ error: "Xodim akkauntini faqat owner o'chira oladi" }, 403);
    }

    const { user_id: targetUserId } = await req.json();

    if (!targetUserId) {
      return json({ error: "user_id kerak" }, 400);
    }

    if (targetUserId === requestingUser.id) {
      return json({ error: "O'z akkauntingizni o'chira olmaysiz" }, 400);
    }

    const { data: targetRoles, error: rolesReadError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId);

    if (rolesReadError) {
      console.error("Error reading target roles:", rolesReadError);
      return json({ error: "Xodim rollarini o'qib bo'lmadi" }, 500);
    }

    const roles = (targetRoles ?? []).map((r: { role: string }) => r.role);
    if (roles.includes("owner")) {
      return json({ error: "Owner akkauntini o'chirib bo'lmaydi" }, 403);
    }
    if (!roles.some((r) => STAFF_ROLES.includes(r))) {
      return json({ error: "Bu akkaunt xodim emas" }, 400);
    }

    // Xodimga biriktirilgan yozuvlar o'chmaydi — faqat biriktirish olib tashlanadi;
    // investor suhbati o'chirayotgan owner'ga o'tadi (migr. 20261030251000).
    const { error: cleanupError } = await adminClient.rpc("prepare_staff_deletion", {
      p_target: targetUserId,
      p_owner: requestingUser.id,
    });
    if (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
      return json({ error: "Xodim yozuvlarini ajratib bo'lmadi, akkaunt o'chirilmadi" }, 500);
    }

    // Avval auth akkaunt: muvaffaqiyatsiz bo'lsa rol va profil joyida qoladi
    // (oldin profil va rollar oldin o'chirilib, akkaunt yarim o'chgan holda qolardi).
    const { error: authError } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (authError) {
      console.error("Error deleting auth user:", authError);
      return json({ error: `Akkauntni o'chirib bo'lmadi: ${authError.message}` }, 500);
    }

    // user_roles auth.users bilan CASCADE o'chadi; qolganlarini qo'lda tozalaymiz
    await adminClient.from("user_roles").delete().eq("user_id", targetUserId);
    await adminClient.from("staff_presence").delete().eq("user_id", targetUserId);

    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("user_id", targetUserId);

    if (profileError) {
      // Akkaunt allaqachon o'chgan — kira olmaydi. Profil qatori qolgani log'ga yoziladi.
      console.error("Error deleting profile:", profileError);
    }

    return json({ success: true }, 200);
  } catch (error) {
    console.error("Error in delete-staff function:", error);
    return json({ error: "Serverda xato" }, 500);
  }
});
