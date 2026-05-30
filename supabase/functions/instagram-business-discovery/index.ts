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

// Baixa uma imagem e salva no Storage — retorna a URL pública ou null se falhar
async function cacheImage(
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  imgUrl: string,
  storagePath: string
): Promise<string | null> {
  if (!imgUrl) return null;
  try {
    const res = await fetch(imgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.instagram.com/",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 500) return null;

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const { error } = await adminClient.storage
      .from("thumbnails")
      .upload(storagePath, bytes, { contentType, upsert: true });

    if (error) {
      console.error("Storage upload error:", error.message);
      return null;
    }

    const { data } = adminClient.storage.from("thumbnails").getPublicUrl(storagePath);
    return data?.publicUrl || null;
  } catch (err) {
    console.error("cacheImage error:", err);
    return null;
  }
}

// Processa em lotes para não sobrecarregar
async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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

  const profileUrl = `https://www.instagram.com/${cleanUsername}/`;

  // Busca posts e detalhes do perfil em paralelo
  const [postsRes, detailsRes] = await Promise.all([
    fetch(
      `https://api.apify.com/v2/acts/apify~instagram-api-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=90`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: [profileUrl], resultsType: "posts", resultsLimit }),
        signal: AbortSignal.timeout(100_000),
      }
    ),
    fetch(
      `https://api.apify.com/v2/acts/apify~instagram-api-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=60`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: [profileUrl], resultsType: "details", resultsLimit: 1 }),
        signal: AbortSignal.timeout(70_000),
      }
    ),
  ]);

  if (!postsRes.ok) {
    const errText = await postsRes.text().catch(() => "");
    return json({ error: `Apify retornou erro ${postsRes.status}. ${errText.substring(0, 200)}` }, 500);
  }

  const items: Record<string, unknown>[] = await postsRes.json();
  if (!items || items.length === 0) {
    return json({ error: "Apify não retornou dados. O perfil pode ser privado ou não existir." }, 400);
  }
  if ((items[0] as Record<string, unknown>).error) {
    return json({ error: "Erro do Apify: " + ((items[0] as Record<string, unknown>).errorDescription || (items[0] as Record<string, unknown>).error) }, 400);
  }

  let profileDetails: Record<string, unknown> = {};
  if (detailsRes.ok) {
    const detailsData = await detailsRes.json().catch(() => []);
    if (Array.isArray(detailsData) && detailsData.length > 0 && !detailsData[0].error) {
      profileDetails = detailsData[0] as Record<string, unknown>;
    }
  }

  const first = items[0] as Record<string, unknown>;

  // Cache da foto do perfil no Storage
  const profilePicOrig = String(profileDetails.profilePicUrlHD || profileDetails.profilePicUrl || "");
  const profilePicCached = profilePicOrig
    ? await cacheImage(adminClient, supabaseUrl, profilePicOrig, `thumbnails/${cleanUsername}/avatar.jpg`)
    : null;

  const profile = {
    username: String(profileDetails.username || first.ownerUsername || cleanUsername),
    name: String(profileDetails.fullName || profileDetails.name || first.ownerFullName || first.ownerUsername || cleanUsername),
    followers_count: Number(profileDetails.followersCount || 0),
    media_count: Number(profileDetails.postsCount || items.length),
    profile_picture_url: profilePicCached || profilePicOrig,
  };

  // Cache das thumbnails dos posts em lotes de 5
  const mediaWithCachedThumbs = await runInBatches(items, 5, async (item) => {
    const it = item as Record<string, unknown>;
    const shortCode = String(it.shortCode || "");
    const origThumb = String(it.displayUrl || "");

    const cachedThumb = origThumb
      ? await cacheImage(adminClient, supabaseUrl, origThumb, `thumbnails/${cleanUsername}/${shortCode}.jpg`)
      : null;

    return {
      id: String(it.id || ""),
      shortcode: shortCode,
      caption: String(it.caption || ""),
      media_type: mapMediaType(it),
      media_product_type: mapMediaProductType(it),
      permalink: String(it.url || `https://www.instagram.com/p/${shortCode}/`),
      timestamp: String(it.timestamp || ""),
      thumbnail_url: cachedThumb || origThumb,
      video_url: String(it.videoUrl || ""),
      like_count: typeof it.likesCount === "number" && it.likesCount >= 0 ? it.likesCount : null,
      comments_count: typeof it.commentsCount === "number" ? it.commentsCount : 0,
      video_view_count: typeof it.videoViewCount === "number" ? it.videoViewCount : null,
      video_play_count: typeof it.videoPlayCount === "number" ? it.videoPlayCount : null,
    };
  });

  return json({ profile, media: mediaWithCachedThumbs, paging: null });
});
