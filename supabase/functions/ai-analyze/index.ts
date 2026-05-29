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

async function toBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i]);
    const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    return { data: btoa(binary), mimeType };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!authHeader || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing authorization or Supabase secrets" }, 401);
  }
  if (!geminiKey) {
    return json({ error: "GEMINI_API_KEY not configured" }, 500);
  }

  const { postId } = await req.json().catch(() => ({}));
  if (!postId) return json({ error: "Missing postId" }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid user session" }, 401);

  const { data: post, error: postError } = await adminClient
    .from("mined_posts")
    .select("caption, thumbnail_url, media_type")
    .eq("id", postId)
    .single();

  if (postError || !post) return json({ error: "Post não encontrado" }, 404);

  const hasCaption = post.caption && post.caption.trim().length >= 5;
  const hasThumbnail = !!post.thumbnail_url;

  if (!hasCaption && !hasThumbnail) {
    return json({ error: "Este post não tem legenda nem imagem de capa para analisar." }, 400);
  }

  // Monta parts multimodal: imagem (se disponível) + texto
  const parts: unknown[] = [];

  if (hasThumbnail) {
    const img = await toBase64(post.thumbnail_url);
    if (img) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }

  const contextLine = hasThumbnail && hasCaption
    ? "Você recebeu a imagem de capa e a legenda de um post de Instagram."
    : hasThumbnail
    ? "Você recebeu apenas a imagem de capa de um post de Instagram (sem legenda)."
    : "Você recebeu apenas a legenda de um post de Instagram (sem imagem).";

  const captionSection = hasCaption
    ? `\n\n**LEGENDA DO POST:**\n"""\n${post.caption}\n"""`
    : "";

  const promptText = `${contextLine}${captionSection}

Você é um estrategista de conteúdo. Analise este post e extraia os padrões estruturais.
Retorne APENAS um JSON puro e válido com esta estrutura exata:

{
  "hook": {
    "text": "frase exata de abertura que chama atenção (da imagem ou legenda)",
    "technique": "nome da técnica (Pergunta provocativa | Quebra de padrão | Afirmação polêmica | Curiosidade | Número | Promessa | História)"
  },
  "headline": "manchete/promessa principal em até 6 palavras",
  "promise": "transformação que o conteúdo promete ao espectador",
  "body_structure": ["ponto 1", "ponto 2", "ponto 3"],
  "authority_arc": "como o autor demonstra autoridade (prova social, história, tom de certeza)",
  "cta": {
    "text": "frase exata da chamada para ação (ou 'Nenhum')",
    "type": "Salvar post | Comentar palavra X | Clicar no link | Seguir | Compartilhar | Nenhum"
  },
  "funnel_stage": "TOFU | MOFU | BOFU",
  "main_theme": "nicho ou subtema central em 1 a 3 palavras"
}`;

  parts.push({ text: promptText });

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return json({ error: "Erro na API do Gemini", details: errorText }, 500);
    }

    const aiData = await response.json();
    let jsonString = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonString) {
      return json({ error: "Gemini retornou resposta vazia" }, 500);
    }

    jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
    const analysisObj = JSON.parse(jsonString);

    const { error: updateError } = await adminClient
      .from("mined_posts")
      .update({
        analysis: analysisObj,
        is_analyzed: true,
        // Salvar caption como transcript se ainda não tiver transcrição real
        ...(post.caption ? { transcript: post.caption, transcript_source: "caption" } : {}),
      })
      .eq("id", postId);

    if (updateError) {
      console.error("Erro ao salvar análise:", updateError);
      return json({ error: "Erro ao salvar análise no banco de dados" }, 500);
    }

    return json({ success: true, analysis: analysisObj });
  } catch (err: unknown) {
    console.error("Erro interno:", err);
    return json({ error: "Falha ao processar análise via Gemini", details: String(err) }, 500);
  }
});
