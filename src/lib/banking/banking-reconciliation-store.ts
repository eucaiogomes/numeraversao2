import { buildBankingReviewItems } from './banking-review-items';
import type {
  BalanceReconciliationResult,
  BankingReviewItem,
  ViacrediInvestmentStatement,
} from './types';

export interface BankingReconciliationCase {
  id: string;
  competence: string;
  createdAt: string;
  fileNames: {
    trialBalance: string;
    ledger: string;
    statements: string[];
  };
  bankAccountsCount: number;
  ledgerAccountsCount: number;
  statementsCount: number;
  investmentStatementsCount: number;
  investmentStatements: ViacrediInvestmentStatement[];
  results: BalanceReconciliationResult[];
  reviewItems: BankingReviewItem[];
}

const bankingStore = new Map<string, BankingReconciliationCase>();
const TABLE_NAME = 'banking_reconciliations';

interface BankingReconciliationRow {
  id: string;
  competence: string;
  created_at: string;
  file_names: BankingReconciliationCase['fileNames'];
  bank_accounts_count: number;
  ledger_accounts_count: number;
  statements_count: number;
  investment_statements_count?: number;
  investment_statements?: ViacrediInvestmentStatement[];
  results: BalanceReconciliationResult[];
  review_items?: BankingReviewItem[];
  payload?: BankingReconciliationCase;
}

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

function toRow(caseData: BankingReconciliationCase): BankingReconciliationRow {
  return {
    id: caseData.id,
    competence: caseData.competence,
    created_at: caseData.createdAt,
    file_names: caseData.fileNames,
    bank_accounts_count: caseData.bankAccountsCount,
    ledger_accounts_count: caseData.ledgerAccountsCount,
    statements_count: caseData.statementsCount,
    investment_statements_count: caseData.investmentStatementsCount,
    investment_statements: caseData.investmentStatements,
    results: caseData.results,
    review_items: caseData.reviewItems,
    payload: caseData,
  };
}

function fromRow(row: BankingReconciliationRow): BankingReconciliationCase {
  const caseData = row.payload ?? {
    id: row.id,
    competence: row.competence,
    createdAt: row.created_at,
    fileNames: row.file_names,
    bankAccountsCount: row.bank_accounts_count,
    ledgerAccountsCount: row.ledger_accounts_count,
    statementsCount: row.statements_count,
    investmentStatementsCount: row.investment_statements_count ?? 0,
    investmentStatements: row.investment_statements ?? [],
    results: row.results,
    reviewItems: row.review_items ?? [],
  };

  return {
    ...caseData,
    investmentStatementsCount:
      caseData.investmentStatementsCount ?? caseData.investmentStatements?.length ?? 0,
    investmentStatements: caseData.investmentStatements ?? [],
    reviewItems: buildBankingReviewItems(caseData.results, caseData.reviewItems),
  };
}

async function supabaseRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Supabase nao configurado.');

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase retornou HTTP ${response.status}.`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function saveBankingReconciliation(caseData: BankingReconciliationCase): Promise<void> {
  const hydratedCase = {
    ...caseData,
    investmentStatementsCount:
      caseData.investmentStatementsCount ?? caseData.investmentStatements?.length ?? 0,
    investmentStatements: caseData.investmentStatements ?? [],
    reviewItems: buildBankingReviewItems(caseData.results, caseData.reviewItems),
  };
  bankingStore.set(caseData.id, hydratedCase);

  if (!getSupabaseConfig()) return;

  try {
    await supabaseRequest(`${TABLE_NAME}?on_conflict=id`, {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(toRow(hydratedCase)),
    });
  } catch (error) {
    console.warn('Nao foi possivel persistir a conciliacao bancaria no Supabase.', error);
  }
}

export async function updateBankingReviewItem(
  reconciliationId: string,
  itemId: string,
  patch: Partial<Pick<BankingReviewItem, 'status' | 'note'>>,
): Promise<BankingReconciliationCase | undefined> {
  const caseData =
    bankingStore.get(reconciliationId) ?? (await fetchBankingReconciliation(reconciliationId));
  if (!caseData) return undefined;

  const updatedCase = {
    ...caseData,
    reviewItems: caseData.reviewItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : item,
    ),
  };

  await saveBankingReconciliation(updatedCase);
  return updatedCase;
}

export function getBankingReconciliation(id: string): BankingReconciliationCase | undefined {
  return bankingStore.get(id);
}

export async function fetchBankingReconciliation(
  id: string,
): Promise<BankingReconciliationCase | undefined> {
  const cached = bankingStore.get(id);
  if (cached) return cached;
  if (!getSupabaseConfig()) return undefined;

  let rows: BankingReconciliationRow[];
  try {
    rows = await supabaseRequest<BankingReconciliationRow[]>(
      `${TABLE_NAME}?id=eq.${encodeURIComponent(id)}&limit=1`,
    );
  } catch (error) {
    console.warn('Nao foi possivel buscar a conciliacao bancaria no Supabase.', error);
    return undefined;
  }

  const row = rows[0];
  if (!row) return undefined;
  const caseData = fromRow(row);
  bankingStore.set(caseData.id, caseData);
  return caseData;
}

export function listBankingReconciliations(): BankingReconciliationCase[] {
  return Array.from(bankingStore.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchBankingReconciliations(): Promise<BankingReconciliationCase[]> {
  if (!getSupabaseConfig()) return listBankingReconciliations();

  let rows: BankingReconciliationRow[];
  try {
    rows = await supabaseRequest<BankingReconciliationRow[]>(
      `${TABLE_NAME}?select=*&order=created_at.desc`,
    );
  } catch (error) {
    console.warn('Nao foi possivel carregar o historico bancario no Supabase.', error);
    return listBankingReconciliations();
  }

  const cases = rows.map(fromRow);
  for (const caseData of cases) bankingStore.set(caseData.id, caseData);
  return cases;
}
