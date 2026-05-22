import { parseQuestorTrialBalance } from './questor-balancete-parser';
import { parseQuestorLedger } from './questor-razao-parser';
import { parseViacrediDocumentPdf } from './viacredi-document-parser';
import type {
  QuestorTrialBalanceParseResult,
  QuestorLedgerParseResult,
  ViacrediStatement,
  ViacrediInvestmentStatement,
} from './types';

export type ClassifiedFileKind =
  | 'trial_balance'
  | 'ledger'
  | 'checking_statement'
  | 'investment_statement'
  | 'unknown';

export type ClassifiedFile =
  | { kind: 'trial_balance'; file: File; result: QuestorTrialBalanceParseResult }
  | { kind: 'ledger'; file: File; result: QuestorLedgerParseResult }
  | { kind: 'checking_statement'; file: File; result: ViacrediStatement }
  | { kind: 'investment_statement'; file: File; result: ViacrediInvestmentStatement }
  | { kind: 'unknown'; file: File; error: string };

export interface ClassificationProgress {
  fileName: string;
  status: 'running' | 'done' | 'error';
  kind?: ClassifiedFileKind;
  detail?: string;
  error?: string;
}

export interface ClassificationSummary {
  trialBalance: (ClassifiedFile & { kind: 'trial_balance' }) | null;
  ledger: (ClassifiedFile & { kind: 'ledger' }) | null;
  checkingStatements: (ClassifiedFile & { kind: 'checking_statement' })[];
  investmentStatements: (ClassifiedFile & { kind: 'investment_statement' })[];
  unknown: (ClassifiedFile & { kind: 'unknown' })[];
}

async function classifyFile(file: File): Promise<ClassifiedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    try {
      const parsed = await parseViacrediDocumentPdf(file);
      if (parsed.type === 'investment_statement') {
        return { kind: 'investment_statement', file, result: parsed.statement };
      }
      return { kind: 'checking_statement', file, result: parsed.statement };
    } catch (e) {
      return { kind: 'unknown', file, error: e instanceof Error ? e.message : 'Falha ao ler PDF' };
    }
  }

  if (ext === 'xls' || ext === 'xlsx') {
    const buffer = await file.arrayBuffer();

    try {
      const tbResult = parseQuestorTrialBalance(buffer);
      if (tbResult.accounts.length > 0) {
        return { kind: 'trial_balance', file, result: tbResult };
      }
    } catch {
      // not a trial balance
    }

    try {
      const ledgerResult = parseQuestorLedger(buffer);
      if (ledgerResult.accounts.length > 0) {
        return { kind: 'ledger', file, result: ledgerResult };
      }
    } catch {
      // not a ledger
    }

    return { kind: 'unknown', file, error: 'Arquivo Excel não reconhecido como Balancete ou Razão' };
  }

  return { kind: 'unknown', file, error: `Formato .${ext ?? '?'} não suportado` };
}

const KIND_LABEL: Record<ClassifiedFileKind, string> = {
  trial_balance: 'Balancete Questor',
  ledger: 'Razão Questor',
  checking_statement: 'Extrato conta corrente',
  investment_statement: 'Extrato aplicação programada',
  unknown: 'Não reconhecido',
};

function kindDetail(classified: ClassifiedFile): string {
  if (classified.kind === 'trial_balance') {
    const { accounts, bankLikeAccounts } = classified.result;
    return `${accounts.length} conta(s) — ${bankLikeAccounts.length} bancária(s)`;
  }
  if (classified.kind === 'ledger') {
    return `${classified.result.accounts.length} conta(s) no razão`;
  }
  if (classified.kind === 'checking_statement') {
    const s = classified.result;
    return `${s.institutionName} · ${s.periodStart} a ${s.periodEnd}`;
  }
  if (classified.kind === 'investment_statement') {
    const s = classified.result;
    return `${s.productName} · ${s.periodStart} a ${s.periodEnd}`;
  }
  return classified.error;
}

export async function runFileClassifierAgent(
  files: File[],
  onProgress: (progress: ClassificationProgress) => void,
): Promise<ClassificationSummary> {
  const results: ClassifiedFile[] = [];

  for (const file of files) {
    onProgress({ fileName: file.name, status: 'running' });

    const classified = await classifyFile(file);
    results.push(classified);

    if (classified.kind === 'unknown') {
      onProgress({
        fileName: file.name,
        status: 'error',
        kind: 'unknown',
        error: classified.error,
      });
    } else {
      onProgress({
        fileName: file.name,
        status: 'done',
        kind: classified.kind,
        detail: `${KIND_LABEL[classified.kind]} — ${kindDetail(classified)}`,
      });
    }
  }

  const summary: ClassificationSummary = {
    trialBalance: null,
    ledger: null,
    checkingStatements: [],
    investmentStatements: [],
    unknown: [],
  };

  for (const r of results) {
    if (r.kind === 'trial_balance') summary.trialBalance = r;
    else if (r.kind === 'ledger') summary.ledger = r;
    else if (r.kind === 'checking_statement') summary.checkingStatements.push(r);
    else if (r.kind === 'investment_statement') summary.investmentStatements.push(r);
    else summary.unknown.push(r as ClassifiedFile & { kind: 'unknown' });
  }

  return summary;
}

export { KIND_LABEL, kindDetail };
