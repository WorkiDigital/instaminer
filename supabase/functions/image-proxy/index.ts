import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Apenas domínios do Instagram/Meta são permitidos
const ALLOWED_HOSTS = [
  "scontent",
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some(h => parsed.hostname.includes(h));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const urlParam = new URL(req.url).searchParams.get("url");
  if (!urlParam) {
    return new Response("Missing url param", { status: 400, headers: corsHeaders });
  }

  if (!isAllowedUrl(urlParam)) {
    return new Response("URL not allowed", { status: 403, headers: corsHeaders });
  }

  try {
    const imgRes = await fetch(urlParam, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Instaminer/1.0)",
        "Referer": "https://www.instagram.com/",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!imgRes.ok) {
      return new Response("Failed to fetch image", { status: 502, headers: corsHeaders });
    }

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const body = await imgRes.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // cache 24h
      },
    });
  } catch {
    return new Response("Proxy error", { status: 500, headers: corsHeaders });
  }
});
