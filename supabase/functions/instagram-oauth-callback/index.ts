import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  // Always return 200 to prevent Supabase FunctionsHttpError from hiding the JSON body
  return new Response(JSON.stringify({ ...body, httpStatus: status }), {
    status: 200,
    headers: jsonHeaders,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const metaAppId = Deno.env.get("META_APP_ID") || Deno.env.get("VITE_META_APP_ID");
  const metaAppSecret = Deno.env.get("META_APP_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !metaAppId || !metaAppSecret) {
    return json({ error: "Missing Supabase or Meta secrets" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const { code, redirectUri } = await req.json().catch(() => ({}));
  if (!code || !redirectUri) return json({ error: "Missing code or redirectUri" }, 400);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid user session" }, 401);

  // 1. Trocar code por short-lived user token via Facebook Login
  const shortTokenParams = new URLSearchParams({
    client_id: metaAppId,
    client_secret: metaAppSecret,
    redirect_uri: redirectUri,
    code,
  });

  const shortTokenRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?${shortTokenParams.toString()}`
  );
  const shortToken = await shortTokenRes.json();

  if (!shortTokenRes.ok || !shortToken.access_token) {
    console.error("FB short token error", shortToken);
    return json({
      error: `Facebook token error ${shortToken.error?.code || shortTokenRes.status}: ${shortToken.error?.message || shortToken.error_description || JSON.stringify(shortToken)}`,
    }, 400);
  }

  // 2. Trocar por long-lived user token (60 dias)
  const longTokenParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: metaAppId,
    client_secret: metaAppSecret,
    fb_exchange_token: shortToken.access_token,
  });

  const longTokenRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?${longTokenParams.toString()}`
  );
  const longToken = await longTokenRes.json();
  const accessToken = longToken.access_token || shortToken.access_token;
  const expiresIn = longToken.expires_in || shortToken.expires_in;

  // 3. Buscar Pages do usuario e o Instagram Business Account vinculado
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username,name}&access_token=${accessToken}`
  );
  const pagesData = await pagesRes.json();

  if (!pagesRes.ok || !pagesData.data) {
    console.error("FB pages error", pagesData);
    return json({
      error: "Nao foi possivel listar suas Paginas do Facebook. Certifique-se de ter concedido permissao 'pages_show_list'.",
    }, 400);
  }

  type FbPage = {
    id: string;
    name: string;
    instagram_business_account?: { id: string; username?: string; name?: string };
  };

  const pageWithIg = (pagesData.data as FbPage[]).find(
    (p) => p.instagram_business_account?.id
  );

  if (!pageWithIg?.instagram_business_account) {
    return json({
      error: "Nenhuma conta Instagram Business foi encontrada vinculada as suas Paginas do Facebook. Acesse Configuracoes > Instagram no gerenciador de negocios da Meta para vincular.",
    }, 400);
  }

  const igAccount = pageWithIg.instagram_business_account;
  const tokenExpiresAt = expiresIn
    ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
    : null;

  const { error: upsertError } = await adminClient
    .from("instagram_connections")
    .upsert(
      {
        user_id: userData.user.id,
        ig_user_id: igAccount.id,
        ig_username: igAccount.username || igAccount.name || null,
        account_type: "BUSINESS",
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        fb_page_id: pageWithIg.id,
        fb_page_name: pageWithIg.name,
      },
      { onConflict: "user_id,ig_user_id" }
    );

  if (upsertError) {
    console.error("Upsert error", upsertError);
    return json({ error: "Nao foi possivel salvar a conexao Instagram" }, 500);
  }

  return json({
    ok: true,
    username: igAccount.username || igAccount.name || null,
    account_type: "BUSINESS",
    fb_page_name: pageWithIg.name,
  });
});
