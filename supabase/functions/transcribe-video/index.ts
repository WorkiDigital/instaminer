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

// Removed fetchMediaUrl since we use Apify now
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing secrets" }, 500);
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid user session" }, 401);

  let post_id: string;
  let videoBytes: ArrayBuffer | null = null;
  let mimeType = "video/mp4";

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    post_id = formData.get("post_id") as string;
    const file = formData.get("file") as File;
    if (file) {
      videoBytes = await file.arrayBuffer();
      mimeType = file.type || "video/mp4";
    }
  } else {
    const body = await req.json().catch(() => ({}));
    post_id = body.post_id;
  }

  if (!post_id) return json({ error: "post_id obrigatório" }, 400);

  // 1. Buscar post + perfil minerado
  const { data: post } = await adminClient
    .from("mined_posts")
    .select("ig_media_id, media_type, mined_profile_id, permalink")
    .eq("id", post_id)
    .single();

  if (!post?.ig_media_id) {
    return json({ error: "Post não encontrado ou sem ig_media_id" }, 404);
  }

  if (post.media_type === "IMAGE") {
    return json({ error: "Este post é uma imagem — não tem áudio para transcrever." }, 400);
  }
  // 2. Buscar videoUrl via Apify (Burlar direitos autorais) se não recebemos arquivo manual
  if (!videoBytes) {
    const apifyToken = Deno.env.get("APIFY_API_TOKEN");
    if (!apifyToken) {
      return json({ error: "APIFY_API_TOKEN não configurado no Supabase." }, 500);
    }

    if (!post.permalink) {
       return json({ error: "Post sem permalink no banco de dados." }, 400);
    }

    // timeout=90s — Apify tem até 90 segundos para responder
    const apifyReq = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-api-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=90`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [post.permalink],
          resultsType: "posts",
          resultsLimit: 1,
        }),
        signal: AbortSignal.timeout(100_000), // 100s no fetch
      }
    );

    if (!apifyReq.ok) {
      const errText = await apifyReq.text().catch(() => "");
      console.error("Apify HTTP error", apifyReq.status, errText);
      return json({ error: `Apify retornou erro ${apifyReq.status}. ${errText.substring(0, 200)}` }, 500);
    }

    const apifyData = await apifyReq.json();
    console.log("Apify response length:", apifyData?.length, "first item keys:", Object.keys(apifyData?.[0] || {}));

    if (!apifyData || apifyData.length === 0) {
      return json({ error: "Apify não retornou dados. O post pode ser privado ou ter sido apagado." }, 500);
    }

    if (apifyData[0].error) {
      return json({ error: "Erro do Apify: " + (apifyData[0].errorDescription || apifyData[0].error) }, 500);
    }

    const mediaUrl = apifyData[0].videoUrl || apifyData[0].video_url || apifyData[0].videoPlaybackQualityList?.[0]?.url;

    if (!mediaUrl) {
      return json({
        error: "O Apify executou, mas não retornou a URL do vídeo (videoUrl vazia).",
      }, 400);
    }

    // 4. Baixar o vídeo da Meta
    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) {
      return json({ error: `Falha ao baixar o vídeo (${videoRes.status}). A URL pode ter expirado — re-mine o perfil.` }, 500);
    }
    videoBytes = await videoRes.arrayBuffer();

    if (!videoBytes || videoBytes.byteLength < 1000) {
      return json({ error: `Vídeo baixado está vazio ou corrompido (${videoBytes?.byteLength ?? 0} bytes). Tente re-minerar o perfil.` }, 500);
    }
    console.log("Video downloaded:", videoBytes.byteLength, "bytes");
  }

  // 5. Enviar para Whisper API
  const whisperKey = Deno.env.get("WHISPER_API_KEY");
  if (!whisperKey) {
    return json({ error: "WHISPER_API_KEY não configurado no Supabase." }, 500);
  }

  const formData = new FormData();
  formData.append(
    "audio_file",
    new Blob([videoBytes!], { type: mimeType }),
    "instagram-video.mp4"
  );

  let transcript = "";
  try {
    const whisperResponse = await fetch(
      "https://n8n-whisper-api.ubufeb.easypanel.host/transcribe?language=pt&task=transcribe",
      {
        method: "POST",
        headers: { "x-api-key": whisperKey },
        body: formData,
      }
    );

    const responseText = await whisperResponse.text();
    console.log("Whisper status:", whisperResponse.status, "body:", responseText.substring(0, 300));

    if (!whisperResponse.ok) {
      return json({ error: `Whisper retornou erro ${whisperResponse.status}: ${responseText.substring(0, 200)}` }, 500);
    }

    let whisperJson: { text?: string; error?: string };
    try {
      whisperJson = JSON.parse(responseText);
    } catch {
      return json({ error: `Whisper retornou resposta inválida: ${responseText.substring(0, 200)}` }, 500);
    }

    if (whisperJson.error) {
      return json({ error: `Whisper reportou erro interno: ${whisperJson.error}` }, 500);
    }

    transcript = whisperJson.text || "";
  } catch (err) {
    console.error("Whisper request failed", err);
    return json({ error: "Falha de conexão com a API do Whisper." }, 500);
  }

  if (!transcript || transcript.trim().length === 0) {
    return json({ error: "O Whisper não conseguiu extrair áudio deste vídeo. Pode ser um vídeo sem fala (só música), ou o arquivo chegou corrompido." }, 500);
  }

  // 7. Salvar transcrição antes de analisar
  await adminClient
    .from("mined_posts")
    .update({ transcript, transcript_source: "whisper", is_analyzed: false })
    .eq("id", post_id);

  // 8. Chamar ai-analyze com a transcrição salva
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  let analysis = null;

  if (geminiKey) {
    try {
      const { data: postForAnalysis } = await adminClient
        .from("mined_posts")
        .select("caption, thumbnail_url")
        .eq("id", post_id)
        .single();

      const prompt = `Você é um especialista em marketing de conteúdo para Instagram.
Analise o roteiro transcrito abaixo e extraia a estrutura do conteúdo em JSON.

ROTEIRO TRANSCRITO:
${transcript}

${postForAnalysis?.caption ? `LEGENDA DO POST:\n${postForAnalysis.caption}` : ""}

Retorne APENAS o JSON, sem markdown, sem explicações:
{
  "headline": "título/promessa principal do vídeo",
  "hook": {
    "text": "primeiras palavras ditas (gancho de abertura)",
    "technique": "pergunta|afirmacao_polemica|numero|promessa|quebra_de_padrao"
  },
  "promise": "o que o criador promete entregar",
  "authority_arc": "como o criador demonstra autoridade",
  "body_structure": ["passo 1", "passo 2"],
  "cta": {
    "text": "chamada para ação",
    "type": "explicito|implicito|ausente"
  },
  "funnel_stage": "TOFU|MOFU|BOFU",
  "main_theme": "tema central do conteúdo"
}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
          }),
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        analysis = JSON.parse(cleaned);
      }
    } catch (err) {
      console.error("Gemini analysis failed (non-fatal):", err);
    }
  }

  // 9. Salvar transcrição + análise
  await adminClient
    .from("mined_posts")
    .update({ transcript, transcript_source: "whisper", analysis, is_analyzed: true })
    .eq("id", post_id);

  return json({ ok: true, transcript, analysis });
});
