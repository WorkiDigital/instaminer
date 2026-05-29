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
  const cta = detectCta(text);

  const bodyLines = lines
    .slice(1)
    .filter(l => !l.startsWith('#') && l.length > 10)
    .slice(0, 3);

  return {
    headline: hook, // primeira frase completa, sem truncagem
    hook: { text: hook, technique: detectHookTechnique(hook) },
    promise: bodyLines[0] || '',
    authority_arc: '',
    body_structure: bodyLines,
    cta,
    funnel_stage: detectFunnelStage(text),
    main_theme: extractTheme(text),
  };
}
