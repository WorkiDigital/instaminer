import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ ...body, httpStatus: status }), {
    status: 200,
    headers: jsonHeaders,
  });
}

// Campos de métricas disponíveis por tipo de mídia na Instagram Insights API
const METRIC_FIELDS_VIDEO = "reach,impressions,saved,shares,likes,comments,plays,total_interactions";
const METRIC_FIELDS_IMAGE = "reach,impressions,saved,shares,likes,comments,total_interactions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing authorization or Supabase secrets" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const { content_item_id } = body as { content_item_id?: string };

  if (!content_item_id) return json({ error: "Missing content_item_id" }, 400);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid user session" }, 401);

  // Busca o content_item para pegar o ig_media_id
  const { data: item, error: itemError } = await adminClient
    .from("content_items")
    .select("id, ig_media_id, user_id")
    .eq("id", content_item_id)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (itemError || !item) return json({ error: "Content item não encontrado" }, 404);
  if (!item.ig_media_id) return json({ error: "Este post ainda não tem ig_media_id. Publique o post antes de buscar métricas." }, 400);

  // Busca o token OAuth do usuário
  const { data: connection, error: connError } = await adminClient
    .from("instagram_connections")
    .select("access_token, ig_user_id")
    .eq("user_id", userData.user.id)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connError || !connection) {
    return json({ error: "Conecte sua conta Instagram Business primeiro em Configurações." }, 400);
  }

  // Primeiro, descobre o media_type para saber quais métricas pedir
  const mediaInfoUrl = new URL(`https://graph.facebook.com/v21.0/${item.ig_media_id}`);
  mediaInfoUrl.searchParams.set("fields", "media_type,media_product_type");
  mediaInfoUrl.searchParams.set("access_token", connection.access_token);

  const mediaInfoRes = await fetch(mediaInfoUrl);
  const mediaInfo = await mediaInfoRes.json();

  if (!mediaInfoRes.ok) {
    console.error("Media info error", mediaInfo);
    if (mediaInfo.error?.code === 190) {
      return json({ error: "Token expirado. Reconecte sua conta Instagram em Configurações.", details: mediaInfo.error }, 401);
    }
    return json({ error: mediaInfo.error?.message || "Erro ao buscar informações do post.", details: mediaInfo.error }, 400);
  }

  const isVideo = mediaInfo.media_type === "VIDEO" || mediaInfo.media_product_type === "REELS";
  const metricFields = isVideo ? METRIC_FIELDS_VIDEO : METRIC_FIELDS_IMAGE;

  // Busca as métricas via Instagram Insights API
  const insightsUrl = new URL(`https://graph.facebook.com/v21.0/${item.ig_media_id}/insights`);
  insightsUrl.searchParams.set("metric", metricFields);
  insightsUrl.searchParams.set("access_token", connection.access_token);

  const insightsRes = await fetch(insightsUrl);
  const insightsPayload = await insightsRes.json();

  if (!insightsRes.ok || !insightsPayload.data) {
    console.error("Insights error", insightsPayload);
    if (insightsPayload.error?.code === 190) {
      return json({ error: "Token expirado. Reconecte sua conta Instagram em Configurações.", details: insightsPayload.error }, 401);
    }
    return json({ error: insightsPayload.error?.message || "Erro ao buscar métricas do post.", details: insightsPayload.error }, 400);
  }

  // Mapeia o array de métricas para um objeto { metricName: value }
  const metricsMap: Record<string, number> = {};
  for (const metric of insightsPayload.data as Array<{ name: string; values?: Array<{ value: number }>; value?: number }>) {
    const value = metric.values?.[0]?.value ?? metric.value ?? 0;
    metricsMap[metric.name] = typeof value === "number" ? value : 0;
  }

  const metricsToSave = {
    content_item_id,
    reach: metricsMap["reach"] ?? null,
    impressions: metricsMap["impressions"] ?? null,
    likes: metricsMap["likes"] ?? null,
    comments: metricsMap["comments"] ?? null,
    saves: metricsMap["saved"] ?? null,
    shares: metricsMap["shares"] ?? null,
    video_views: metricsMap["plays"] ?? null,
    raw: insightsPayload.data as Record<string, unknown>,
  };

  // Upsert: se já existe snapshot para hoje, atualiza; senão insere
  const today = new Date().toISOString().split("T")[0];
  const { data: existing } = await adminClient
    .from("content_metrics")
    .select("id")
    .eq("content_item_id", content_item_id)
    .gte("snapshot_at", `${today}T00:00:00Z`)
    .lte("snapshot_at", `${today}T23:59:59Z`)
    .maybeSingle();

  let saveError;
  if (existing?.id) {
    const { error } = await adminClient
      .from("content_metrics")
      .update(metricsToSave)
      .eq("id", existing.id);
    saveError = error;
  } else {
    const { error } = await adminClient
      .from("content_metrics")
      .insert({ ...metricsToSave, snapshot_at: new Date().toISOString() });
    saveError = error;
  }

  if (saveError) {
    console.error("Save metrics error", saveError);
    return json({ error: "Erro ao salvar métricas no banco.", details: saveError }, 500);
  }

  return json({ success: true, metrics: metricsToSave });
});
