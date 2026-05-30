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

// Mapeia o tipo do post Apify para o padrão do banco
function mapMediaType(item: Record<string, unknown>): string {
  const productType = String(item.productType || "").toLowerCase();
  const type = String(item.type || "").toLowerCase();
  if (productType === "clips" || type === "video") return "VIDEO";
  if (type === "sidecar") return "CAROUSEL_ALBUM";
  return "IMAGE";
}

function mapMediaProductType(item: Record<string, unknown>): string {
  const productType = String(item.productType || "").toLowerCase();
  if (productType === "clips") return "REELS";
  const type = String(item.type || "").toLowerCase();
  if (type === "sidecar") return "CAROUSEL_ALBUM";
  return "FEED";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apifyToken = Deno.env.get("APIFY_API_TOKEN");

  if (!authHeader || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing authorization or Supabase secrets" }, 401);
  }
  if (!apifyToken) {
    return json({ error: "APIFY_API_TOKEN não configurado no Supabase." }, 500);
  }

  const { username, resultsLimit = 20 } = await req.json().catch(() => ({}));
  const cleanUsername = String(username || "").replace("@", "").trim();
  if (!cleanUsername) return json({ error: "Missing username" }, 400);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid user session" }, 401);

  // Chama Apify instagram-api-scraper (run-sync-get-dataset-items = síncrono, aguarda o resultado)
  const profileUrl = `https://www.instagram.com/${cleanUsername}/`;

  const apifyRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-api-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=90`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [profileUrl],
        resultsType: "posts",
        resultsLimit,
      }),
      signal: AbortSignal.timeout(100_000),
    }
  );

  if (!apifyRes.ok) {
    const errText = await apifyRes.text().catch(() => "");
    console.error("Apify HTTP error", apifyRes.status, errText);
    return json({ error: `Apify retornou erro ${apifyRes.status}. ${errText.substring(0, 200)}` }, 500);
  }

  const items: Record<string, unknown>[] = await apifyRes.json();
  console.log("Apify items count:", items?.length, "first item error:", (items?.[0] as Record<string, unknown>)?.error);

  if (!items || items.length === 0) {
    return json({ error: "Apify não retornou dados. O perfil pode ser privado ou não existir." }, 400);
  }

  if ((items[0] as Record<string, unknown>).error) {
    return json({ error: "Erro do Apify: " + ((items[0] as Record<string, unknown>).errorDescription || (items[0] as Record<string, unknown>).error) }, 400);
  }

  // Todos os itens têm ownerUsername — pega dados do perfil do primeiro
  const first = items[0] as Record<string, unknown>;
  const profile = {
    username: String(first.ownerUsername || cleanUsername),
    name: String(first.ownerFullName || first.ownerUsername || cleanUsername),
    followers_count: 0, // Apify posts não retorna followers — só via profileType
    media_count: items.length,
    profile_picture_url: "",
  };

  // Mapeia posts para o formato que o frontend espera
  const media = items.map((item) => {
    const it = item as Record<string, unknown>;
    const shortCode = String(it.shortCode || "");
    return {
      id: String(it.id || ""),
      shortcode: shortCode,
      caption: String(it.caption || ""),
      media_type: mapMediaType(it),
      media_product_type: mapMediaProductType(it),
      permalink: String(it.url || `https://www.instagram.com/p/${shortCode}/`),
      timestamp: String(it.timestamp || ""),
      thumbnail_url: String(it.displayUrl || ""),
      video_url: String(it.videoUrl || ""),
      like_count: typeof it.likesCount === "number" && it.likesCount >= 0 ? it.likesCount : null,
      comments_count: typeof it.commentsCount === "number" ? it.commentsCount : 0,
      video_view_count: typeof it.videoViewCount === "number" ? it.videoViewCount : null,
      video_play_count: typeof it.videoPlayCount === "number" ? it.videoPlayCount : null,
    };
  });

  return json({ profile, media, paging: null });
});
