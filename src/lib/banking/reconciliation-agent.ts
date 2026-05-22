import {
  buildBankLikeAccountsFromLedger,
  matchBankAccountsToStatements,
} from './account-statement-matcher';
import { reconcileAccountStatementByBalance } from './balance-reconciliation-engine';
import { buildBankingReviewItems } from './banking-review-items';
import type { ClassificationSummary } from './file-classifier-agent';
import type { BalanceReconciliationResult, BankingReviewItem } from './types';

export interface ReconciliationStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

export interface ReconciliationAgentResult {
  results: BalanceReconciliationResult[];
  reviewItems: BankingReviewItem[];
  steps: ReconciliationStep[];
}

function fmtCurrency(value: number | undefined): string {
  if (value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '?';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildStepLabel(result: BalanceReconciliationResult): string {
  const period = result.periodStart
    ? `${fmtDate(result.periodStart)} – ${fmtDate(result.periodEnd)}`
    : '';
  return `${result.accountCode} — ${result.accountName}${period ? ` (${period})` : ''}`;
}

function buildStepDetail(result: BalanceReconciliationResult): { detail: string; isError: boolean } {
  switch (result.status) {
    case 'reconciled': {
      const date = fmtDate(result.finalCheckpoint?.date);
      const bal = fmtCurrency(result.finalCheckpoint?.statementBalance);
      return { detail: `Saldo ${date}: ${bal} — conciliada ✓`, isError: false };
    }
    case 'divergent': {
      const finalDate = fmtDate(result.finalCheckpoint?.date);
      const finalBal = fmtCurrency(result.finalCheckpoint?.statementBalance);
      const lastOk = result.lastMatchedCheckpoint
        ? `Último OK: ${fmtDate(result.lastMatchedCheckpoint.date)}`
        : 'Sem dia OK no período';
      const divDate = fmtDate(result.firstDivergentCheckpoint?.date);
      const diff = fmtCurrency(result.difference);
      return {
        detail: `Saldo ${finalDate}: ${finalBal} — divergente ✗  ·  ${lastOk}  ·  Diferença em ${divDate}: ${diff}`,
        isError: true,
      };
    }
    case 'missing_statement':
      return { detail: 'Sem extrato correspondente', isError: true };
    case 'missing_ledger':
      return { detail: 'Conta não encontrada no Razão', isError: true };
    case 'investment_statement_parsed':
      return { detail: 'Extrato de aplicação lido — revisão pendente', isError: false };
    case 'insufficient_data':
      return { detail: 'Dados insuficientes para conciliar', isError: true };
    default:
      return { detail: result.message, isError: false };
  }
}

const STEP_DELAY_MS = 320;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runReconciliationAgent(
  summary: ClassificationSummary,
  onStepUpdate: (steps: ReconciliationStep[]) => void,
): Promise<ReconciliationAgentResult> {
  if (!summary.ledger) {
    throw new Error('Razão Questor não disponível para conciliação.');
  }

  const allStatements = summary.checkingStatements.map((s) => s.result);
  const allInvestments = summary.investmentStatements.map((s) => s.result);
  const bankLikeAccounts =
    summary.trialBalance?.result.bankLikeAccounts ?? buildBankLikeAccountsFromLedger(summary.ledger.result);

  if (bankLikeAccounts.length === 0) {
    throw new Error('Não foi possível identificar contas bancárias no Razão ou no balancete.');
  }

  const matches = matchBankAccountsToStatements(
    bankLikeAccounts,
    summary.ledger.result,
    allStatements,
    allInvestments,
  );

  // Build initial pending steps — one per match
  const steps: ReconciliationStep[] = matches.map((match, i) => {
    const period = match.statement
      ? `${fmtDate(match.statement.periodStart)} – ${fmtDate(match.statement.periodEnd)}`
      : match.investmentStatement
        ? `${fmtDate(match.investmentStatement.periodStart)} – ${fmtDate(match.investmentStatement.periodEnd)}`
        : '';
    return {
      id: `match-${i}`,
      label: `${match.account.accountCode} — ${match.account.name}${period ? ` (${period})` : ''}`,
      status: 'pending',
    };
  });

  onStepUpdate([...steps]);

  const results: BalanceReconciliationResult[] = [];

  for (let i = 0; i < matches.length; i++) {
    steps[i] = { ...steps[i], status: 'running' };
    onStepUpdate([...steps]);

    await delay(STEP_DELAY_MS);

    const result = reconcileAccountStatementByBalance(matches[i]);
    results.push(result);

    const { detail, isError } = buildStepDetail(result);
    steps[i] = {
      ...steps[i],
      label: buildStepLabel(result),
      status: isError ? 'error' : 'done',
      detail,
    };
    onStepUpdate([...steps]);

    await delay(STEP_DELAY_MS / 2);
  }

  const reviewItems = buildBankingReviewItems(results);

  return { results, reviewItems, steps };
}
