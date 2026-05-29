import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ ...body, httpStatus: status }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function pollMediaStatus(igUserId: string, creationId: string, accessToken: string): Promise<string> {
  // Tenta até 8x com intervalo de 5s = máximo 40s (dentro do timeout de 60s do Supabase)
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${accessToken}`
    );
    const data = await res.json();
    console.log(`Poll ${i + 1}: status_code=${data.status_code}`);
    if (data.status_code === "FINISHED") return creationId;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Processamento falhou: ${data.status || data.status_code}`);
    }
  }
  throw new Error("O Instagram ainda está processando o vídeo. Aguarde 1 minuto e tente publicar novamente.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Configuração do servidor incompleta" }, 500);
  }

  const { content_item_id, caption } = await req.json().catch(() => ({}));
  if (!content_item_id) return json({ error: "Faltando content_item_id" }, 400);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sessão inválida" }, 401);

  const userId = userData.user.id;

  // 1. Busca o content_item
  const { data: item, error: itemError } = await adminClient
    .from("content_items")
    .select("*")
    .eq("id", content_item_id)
    .eq("user_id", userId)
    .single();

  if (itemError || !item) return json({ error: "Conteúdo não encontrado" }, 404);
  if (!item.video_storage_path) return json({ error: "Nenhum vídeo enviado para este conteúdo. Faça o upload primeiro." }, 400);

  // 2. Busca a conexão Instagram do usuário
  const { data: conn, error: connError } = await adminClient
    .from("instagram_connections")
    .select("ig_user_id, access_token, token_expires_at")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false })
    .limit(1)
    .single();

  if (connError || !conn) return json({ error: "Conta Instagram não conectada. Vá em Configurações e conecte sua conta." }, 400);

  // Verifica se o token não expirou
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    return json({ error: "Token do Instagram expirado. Reconecte sua conta em Configurações." }, 401);
  }

  const { ig_user_id: igUserId, access_token: accessToken } = conn;

  // 3. Gera URL pública assinada (1 hora) para o vídeo no Storage
  const { data: signedData, error: signedError } = await adminClient
    .storage
    .from("content-videos")
    .createSignedUrl(item.video_storage_path, 3600);

  if (signedError || !signedData?.signedUrl) {
    return json({ error: "Erro ao gerar URL do vídeo. Tente novamente." }, 500);
  }

  const videoUrl = signedData.signedUrl;

  // 4. Criar media container no Instagram
  const captionText = caption || item.headline || item.title || "";
  const containerParams = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl,
    caption: captionText,
    share_to_feed: "true",
    access_token: accessToken,
  });

  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    { method: "POST", body: containerParams }
  );
  const containerData = await containerRes.json();

  if (!containerRes.ok || !containerData.id) {
    console.error("IG container error", containerData);
    const errMsg = containerData.error?.message || JSON.stringify(containerData);
    return json({ error: `Erro ao criar container no Instagram: ${errMsg}` }, 500);
  }

  const creationId = containerData.id;

  // 5. Aguarda processamento
  try {
    await pollMediaStatus(igUserId, creationId, accessToken);
  } catch (err: unknown) {
    return json({ error: String(err) }, 500);
  }

  // 6. Publica o container
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    { method: "POST", body: publishParams }
  );
  const publishData = await publishRes.json();

  if (!publishRes.ok || !publishData.id) {
    console.error("IG publish error", publishData);
    const errMsg = publishData.error?.message || JSON.stringify(publishData);
    return json({ error: `Erro ao publicar no Instagram: ${errMsg}` }, 500);
  }

  const igMediaId = publishData.id;

  // 7. Atualiza o content_item no banco
  await adminClient
    .from("content_items")
    .update({
      status: "posted",
      publish_method: "api",
      ig_media_id: igMediaId,
      posted_at: new Date().toISOString(),
    })
    .eq("id", content_item_id);

  return json({ success: true, ig_media_id: igMediaId });
});
