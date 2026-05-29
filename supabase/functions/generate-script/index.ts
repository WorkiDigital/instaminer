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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!authHeader || !supabaseUrl || !serviceRoleKey || !geminiKey) {
    return json({ error: "Configuração do servidor incompleta" }, 500);
  }

  const { content_item_id, target_audience_id } = await req.json().catch(() => ({}));
  if (!content_item_id) return json({ error: "Faltando content_item_id" }, 400);
  if (!target_audience_id) return json({ error: "Por favor, selecione um Público-Alvo na barra lateral primeiro." }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sessão inválida" }, 401);

  // 1. Fetch content item, analysis, and brand tone
  const { data: item, error: itemError } = await adminClient
    .from("content_items")
    .select(`
      *,
      profiles(brand_tone)
    `)
    .eq("id", content_item_id)
    .single();

  if (itemError || !item) {
    return json({ error: "Card de conteúdo não encontrado" }, 404);
  }

  // 1.5 Fetch target audience
  const { data: audience, error: audError } = await adminClient
    .from("target_audiences")
    .select("*")
    .eq("id", target_audience_id)
    .single();

  if (audError || !audience) {
    return json({ error: "Público-Alvo selecionado não encontrado no banco de dados." }, 400);
  }

  const analysis = item.source_analysis || {};
  const profile = item.profiles;

  // 2. Montar o super-prompt
  const promptText = `
Você é um estrategista de conteúdo para Instagram e um excelente Copywriter.
Sua missão é MODELAR (não copiar) a estrutura de um post viral de referência, mas criar um roteiro 100% INÉDITO para o público-alvo e nicho do usuário.

📋 **A ESTRUTURA DO POST VIRAL ORIGINAL:**
- Gancho (Técnica): ${analysis.hook?.technique || 'Geral'}
- Promessa/Headline Original: ${analysis.headline || item.title || 'Nenhuma'}
- Estrutura do Corpo: ${analysis.body_structure || 'Lista/Narrativa'}
- Chamada para Ação (CTA): ${analysis.cta?.text || 'Nenhuma'} (${analysis.cta?.type || ''})
- Etapa do Funil: ${item.funnel_stage || 'Topo'}

🎯 **O MEU PÚBLICO-ALVO:**
- Nome: ${audience.name}
- Dores: ${audience.pain_points || 'Dores comuns da área'}
- Desejos: ${audience.desires || 'Melhorar a vida e economizar tempo'}
- Nível de Consciência: ${audience.awareness_level || 'Consciente do problema'}
- Objeções: ${audience.objections || 'Falta de tempo e dinheiro'}
- Tom de Voz do Público: ${audience.language_tone || 'Natural e empático'}

🏢 **MINHA MARCA:**
- Tom de Voz da Marca: ${profile?.brand_tone || 'Autoridade, acolhedor e direto'}

---
**INSTRUÇÕES DE GERAÇÃO:**
1. Baseado nas dores e desejos do MEU público, crie um novo tema usando a MESMA técnica de Gancho e estrutura do post viral.
2. Escreva o Roteiro Falado palavra por palavra para um vídeo curto (Reels/TikTok) de 30 a 60 segundos.
3. Não use jargões difíceis se o público for iniciante, respeite o Nível de Consciência.
4. O roteiro deve ser fluido, sem marcadores robóticos, como se a pessoa estivesse falando olhando para a câmera.

Retorne APENAS um JSON válido no seguinte formato:
{
  "new_hook": "O texto exato do novo gancho (primeiros 3 segundos)",
  "new_headline": "O título sugerido para a capa do vídeo",
  "new_cta": "A frase exata do CTA no final do vídeo",
  "script": "O roteiro COMPLETO falado palavra por palavra, dividindo em parágrafos. Use dicas visuais entre colchetes se precisar, ex: [Corta para a tela do celular]."
}
`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return json({ error: "Erro na API do Gemini", details: errorText }, 500);
    }

    const aiData = await response.json();
    let jsonString = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonString) {
      return json({ error: "O Gemini não retornou o roteiro." }, 500);
    }

    // Limpar o markdown caso retorne
    jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();

    const resultObj = JSON.parse(jsonString);

    // Salvar o resultado no Supabase
    const { error: updateError } = await adminClient
      .from("content_items")
      .update({
        generated_script: resultObj.script,
        hook: resultObj.new_hook,
        headline: resultObj.new_headline,
        cta: resultObj.new_cta,
        target_audience_id: target_audience_id,
        status: item.status === 'idea_bank' ? 'modeled' : item.status // avança o status se for a primeira vez
      })
      .eq("id", content_item_id);

    if (updateError) {
      return json({ error: "Erro ao salvar o roteiro no banco de dados." }, 500);
    }

    return json({ success: true, result: resultObj });
  } catch (err: unknown) {
    console.error(err);
    return json({ error: "Falha ao processar a geração via Gemini", details: String(err) }, 500);
  }
});
