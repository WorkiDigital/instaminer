import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function json(body: Record<string, unknown>, status = 200) {
  // Always return 200 to prevent Supabase FunctionsHttpError from hiding the JSON body
  return new Response(JSON.stringify({ ...body, httpStatus: status }), {
    status: 200,
    headers: jsonHeaders,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing authorization or Supabase secrets" }, 401);
  }

  const { username } = await req.json().catch(() => ({}));
  const cleanUsername = String(username || "").replace("@", "").trim();
  if (!cleanUsername) return json({ error: "Missing username" }, 400);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid user session" }, 401);

  const { data: connection, error: connectionError } = await adminClient
    .from("instagram_connections")
    .select("ig_user_id, access_token, ig_username, fb_page_id")
    .eq("user_id", userData.user.id)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectionError || !connection) {
    return json({ error: "Conecte sua conta Instagram Business primeiro em Configuracoes." }, 400);
  }

  // fb_page_id check removed

  // Business Discovery via Facebook Graph API (requer Facebook Login + Pagina vinculada)
  const fields = [
    `business_discovery.username(${cleanUsername}){`,
    "id,username,name,profile_picture_url,followers_count,media_count",
    ",media.limit(24){id,caption,like_count,comments_count,media_type,permalink,timestamp,thumbnail_url}",
    "}",
  ].join("");

  const discoveryUrl = new URL(
    `https://graph.facebook.com/v21.0/${connection.ig_user_id}`
  );
  discoveryUrl.searchParams.set("fields", fields);
  discoveryUrl.searchParams.set("access_token", connection.access_token);

  const response = await fetch(discoveryUrl);
  const payload = await response.json();

  if (!response.ok || !payload.business_discovery) {
    console.error("Business Discovery error", payload);

    const errCode = payload.error?.code;
    const errMsg: string = payload.error?.message || "";

    if (errCode === 100 && errMsg.includes("business_discovery")) {
      return json({
        error: "Business Discovery nao disponivel. A conta alvo pode ser pessoal (nao Business/Creator) ou estar com o perfil privado.",
        details: payload.error,
      }, 400);
    }

    if (errCode === 190) {
      return json({
        error: "Token expirado. Reconecte sua conta Instagram em Configuracoes.",
        details: payload.error,
      }, 401);
    }

    return json({
      error: payload.error?.message || "Nao foi possivel buscar o perfil solicitado.",
      details: payload.error || payload,
    }, 400);
  }

  const profile = payload.business_discovery;
  return json({
    profile: {
      username: profile.username || cleanUsername,
      name: profile.name || profile.username || cleanUsername,
      followers_count: profile.followers_count || 0,
      media_count: profile.media_count || 0,
      profile_picture_url: profile.profile_picture_url || "",
    },
    media: profile.media?.data || [],
  });
});
