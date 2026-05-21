import { createServerFn } from '@tanstack/react-start';
import type { Divergence } from './matching-engine';
import type { OFXTransaction } from './ofx-parser';
import type { CSVTransaction } from './csv-parser';

interface DivergenceInput {
  id: string;
  side: string;
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

function buildPrompt(divergencesJson: string, period: string, accountLabel: string): string {
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
- Conta: ${accountLabel}
- Lado A = extrato bancário, Lado B = razão contábil

Divergências:
${divergencesJson}

Responda SOMENTE em JSON válido (sem markdown, sem explicações fora do JSON):
[
  {
    "divergence_id": "...",
    "probable_cause": "...",
    "suggested_action": "...",
    "confidence": "high"
  }
]`;
}

async function callGroq(prompt: string, apiKey: string): Promise<AnalysisResult[]> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const result = await response.json();
  const text: string = result.choices?.[0]?.message?.content ?? '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  return JSON.parse(jsonMatch[0]) as AnalysisResult[];
}

async function callAnthropic(prompt: string, apiKey: string): Promise<AnalysisResult[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const result = await response.json();
  const text: string = result.content?.[0]?.text ?? '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  return JSON.parse(jsonMatch[0]) as AnalysisResult[];
}

export const analyzeDivergencesBatch = createServerFn({ method: 'POST' })
  .validator(
    (data: unknown) =>
      data as {
        divergences: DivergenceInput[];
        period: string;
        accountLabel: string;
      },
  )
  .handler(async ({ data }) => {
    const { divergences, period, accountLabel } = data;

    const groqKey = process.env.GROQ_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!groqKey && !anthropicKey) {
      throw new Error('Nenhuma chave de IA configurada (GROQ_API_KEY ou ANTHROPIC_API_KEY)');
    }

    const prompt = buildPrompt(JSON.stringify(divergences, null, 2), period, accountLabel);

    // Prefer Groq when available (faster + free tier), fallback to Anthropic
    if (groqKey) {
      return await callGroq(prompt, groqKey);
    }
    return await callAnthropic(prompt, anthropicKey!);
  });

export function buildDivergenceInputs(
  divergences: Divergence[],
  txsA: OFXTransaction[],
  txsB: CSVTransaction[],
): DivergenceInput[] {
  const mapA = new Map(txsA.map((t) => [t.id, t]));
  const mapB = new Map(txsB.map((t) => [t.id, t]));

  return divergences.map((d) => {
    const tx = d.transactionAId ? mapA.get(d.transactionAId) : mapB.get(d.transactionBId!);
    return {
      id: d.id,
      side: d.side === 'a_only' ? 'extrato bancário (A)' : 'razão contábil (B)',
      date: tx?.postedAt ?? '',
      amount: tx?.amount ?? 0,
      description: tx?.description ?? '',
    };
  });
}
