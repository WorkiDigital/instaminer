import type { PostAnalysis } from '../types/database';

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?\n]{5,}/);
  return (match?.[0] ?? text.substring(0, 120)).trim();
}

function detectHookTechnique(hook: string): string {
  if (hook.includes('?')) return 'Pergunta provocativa';
  if (/\b\d+\b/.test(hook)) return 'Número';
  if (/nunca|impossível|mentira|erro|mito|verdade|absurdo|polêmic/i.test(hook)) return 'Afirmação polêmica';
  if (/imagina|descobri|quando eu|fui|estava|história|aconteceu/i.test(hook)) return 'História';
  if (/como|passo a passo|método|estratégia|vai aprender|te ensino|segredo/i.test(hook)) return 'Promessa';
  return 'Curiosidade';
}

function detectCta(text: string): { text: string; type: string } {
  const patterns: Array<{ re: RegExp; type: string }> = [
    { re: /coment[ae]\s+["']?([A-ZÁÉÍÓÚÃÕ]{2,})["']?/i, type: 'Comentar palavra X' },
    { re: /digit[ae]\s+["']?([A-ZÁÉÍÓÚÃÕ]{2,})["']?/i,  type: 'Comentar palavra X' },
    { re: /salv[ae]\s+(esse|este|o)\s+post/i,             type: 'Salvar post' },
    { re: /link\s+na\s+bio/i,                             type: 'Clicar no link' },
    { re: /me\s+(chama|manda)\s+(no\s+)?(DM|direct)/i,   type: 'Clicar no link' },
    { re: /acessa\s+o\s+link/i,                           type: 'Clicar no link' },
    { re: /compartilh/i,                                  type: 'Compartilhar' },
    { re: /seg[ue]+\s+(o\s+)?perfil/i,                   type: 'Seguir' },
  ];
  for (const { re, type } of patterns) {
    const m = text.match(re);
    if (m) return { text: m[0].trim(), type };
  }
  return { text: 'Nenhum', type: 'Nenhum' };
}

function detectFunnelStage(text: string): string {
  if (/compr[ae]|oferta|preço|desconto|vend[aeo]|pagamento|acesso|matrícul|inscriç/i.test(text)) return 'BOFU';
  if (/coment[ae]|digit[ae]|salv[ae]|compartilh|engaj|link na bio/i.test(text)) return 'MOFU';
  return 'TOFU';
}

function detectContentType(text: string): string {
  if (/vend[aeo]|compr[ae]|oferta|preço|desconto/i.test(text)) return 'venda';
  if (/bast[ie]dores|dia a dia|rotina|vida real/i.test(text)) return 'bastidores';
  if (/motiv[ae]|inspir[ae]|acredit[ae]|força|nunca desist/i.test(text)) return 'inspiração';
  if (/notícia|trend|viral|novo|lançamento/i.test(text)) return 'entretenimento';
  return 'educativo';
}

function extractTheme(text: string): string {
  const tags = text.match(/#(\w+)/g);
  if (tags && tags.length > 0) return tags[0].replace('#', '');
  const words = text.match(/\b[A-ZÁÉÍÓÚÃÕ][a-záéíóúãõ]{3,}\b/g) || [];
  return words[0] || 'conteúdo';
}

export function extractAnalysisFromCaption(caption: string): PostAnalysis {
  const text = caption.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const hook = firstSentence(lines[0] || text);
  const hookTechnique = detectHookTechnique(hook);
  const cta = detectCta(text);
  const funnelStage = detectFunnelStage(text);

  // Headline: primeira linha até 60 chars
  const headline = (lines[0] || hook).substring(0, 60);

  // Body: linhas do meio sem hashtags, máx 3
  const bodyLines = lines
    .slice(1)
    .filter(l => !l.startsWith('#') && l.length > 10)
    .slice(0, 3);

  // Promise: segunda frase/linha
  const promise = bodyLines[0] || '';

  // Theme
  const mainTheme = extractTheme(text);

  return {
    headline,
    hook: { text: hook, technique: hookTechnique as never },
    promise,
    authority_arc: '',
    body_structure: bodyLines as never,
    cta: { text: cta.text, type: cta.type as never },
    funnel_stage: funnelStage as never,
    main_theme: mainTheme,
  };
}
