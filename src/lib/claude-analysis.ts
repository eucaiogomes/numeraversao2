import type { Divergence, TransactionSource } from './matching-engine';

interface DivergenceInput {
  id: string;
  source: string;
  date: string;
  amount: number;
  description: string;
}

export interface AnalysisResult {
  divergence_id: string;
  probable_cause: string;
  suggested_action: string;
  confidence: 'high' | 'medium' | 'low';
}

function buildPrompt(divergencesJson: string, period: string, sources: string[]): string {
  return `Você é um assistente contábil especializado em conciliação bancária.
Para cada divergência abaixo, identifique:
1. CAUSA PROVÁVEL (1 frase curta)
2. AÇÃO SUGERIDA (1 frase imperativa)
3. CONFIANÇA (high | medium | low)

Categorias comuns:
- Tarifa bancária não lançada
- Lançamento em data diferente
- Estorno processado em um lado
- Erro de digitação
- Lançamento duplicado
- Transferência interna
- Rendimento de aplicação
- IOF ou imposto

Contexto:
- Período: ${period}
- Fontes de dados: ${sources.join(', ')}

Divergências (lançamentos sem correspondência em nenhuma outra fonte):
${divergencesJson}

Responda SOMENTE em JSON válido (sem markdown):
[
  {
    "divergence_id": "...",
    "probable_cause": "...",
    "suggested_action": "...",
    "confidence": "high"
  }
]`;
}

function parseJsonResult(text: string): AnalysisResult[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]) as AnalysisResult[];
  } catch {
    return [];
  }
}

async function callGroq(prompt: string, apiKey: string): Promise<AnalysisResult[]> {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 4000, temperature: 0.1, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Groq: ${await r.text()}`);
  const j = await r.json();
  return parseJsonResult(j.choices?.[0]?.message?.content ?? '');
}

async function callOpenAI(prompt: string, apiKey: string): Promise<AnalysisResult[]> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 4000, temperature: 0.1, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`OpenAI: ${await r.text()}`);
  const j = await r.json();
  return parseJsonResult(j.choices?.[0]?.message?.content ?? '');
}

async function callAnthropic(prompt: string, apiKey: string): Promise<AnalysisResult[]> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Anthropic: ${await r.text()}`);
  const j = await r.json();
  return parseJsonResult(j.content?.[0]?.text ?? '');
}

export async function analyzeDivergencesBatch(data: { divergences: DivergenceInput[]; period: string; sourceLabels: string[] }): Promise<AnalysisResult[]> {
  const { divergences, period, sourceLabels } = data;
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

  if (!groqKey && !openaiKey && !anthropicKey) {
    throw new Error('Nenhuma chave de IA configurada');
  }

  const prompt = buildPrompt(JSON.stringify(divergences, null, 2), period, sourceLabels);

  if (groqKey) {
    try { return await callGroq(prompt, groqKey); } catch (e) {
      console.warn('Groq falhou:', e instanceof Error ? e.message : e);
      if (!openaiKey && !anthropicKey) throw e;
    }
  }
  if (openaiKey) {
    try { return await callOpenAI(prompt, openaiKey); } catch (e) {
      console.warn('OpenAI falhou:', e instanceof Error ? e.message : e);
      if (!anthropicKey) throw e;
    }
  }
  return await callAnthropic(prompt, anthropicKey!);
}

export function buildDivergenceInputs(
  divergences: Divergence[],
  sources: TransactionSource[],
): DivergenceInput[] {
  const txMap = new Map(
    sources.flatMap((s) => s.transactions.map((t) => [t.id, { tx: t, label: s.label }])),
  );
  return divergences.map((d) => {
    const entry = txMap.get(d.transactionId);
    return {
      id: d.id,
      source: entry?.label ?? d.sourceId,
      date: entry?.tx.postedAt ?? '',
      amount: entry?.tx.amount ?? 0,
      description: entry?.tx.description ?? '',
    };
  });
}
