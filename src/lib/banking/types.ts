export type AccountingBalanceSide = 'debit' | 'credit' | 'none';

export type BankAccountKind = 'bank_account' | 'cash_investment' | 'other';

export interface QuestorTrialBalanceAccount {
  accountCode: string;
  isSynthetic: boolean;
  classification: string;
  name: string;
  previousBalance: number;
  debit: number;
  credit: number;
  endingBalance: number;
  kind: BankAccountKind;
  rowNumber: number;
  rawData: Record<string, unknown>;
}

export interface QuestorTrialBalanceParseResult {
  accounts: QuestorTrialBalanceAccount[];
  analyticalAccounts: QuestorTrialBalanceAccount[];
  bankLikeAccounts: QuestorTrialBalanceAccount[];
}

export interface QuestorLedgerEntry {
  accountCode: string;
  accountName: string;
  date: string;
  history: string;
  counterpartyAccount?: string;
  description?: string;
  debit: number;
  credit: number;
  amount: number;
  balance: number;
  balanceSide: AccountingBalanceSide;
  branch?: string;
  user?: string;
  origin?: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
}

export interface QuestorLedgerAccount {
  accountCode: string;
  accountName: string;
  entries: QuestorLedgerEntry[];
  dailyBalances: Record<string, number>;
}

export interface QuestorLedgerParseResult {
  accounts: QuestorLedgerAccount[];
  accountsByCode: Record<string, QuestorLedgerAccount>;
}

export interface BankStatementEntry {
  date: string;
  description: string;
  amount: number;
  balance: number;
  document?: string;
  sequence: number;
  rawTokens: string[];
}

export interface ViacrediStatement {
  institutionName: 'VIACREDI';
  customerName?: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  finalBalance: number;
  entries: BankStatementEntry[];
  dailyBalances: Record<string, number>;
  rawTextTokens: string[];
}

export type InvestmentStatementEntryKind =
  | 'monthly_application'
  | 'income_provision'
  | 'income_tax'
  | 'redemption'
  | 'other';

export interface InvestmentStatementEntry {
  date: string;
  description: string;
  kind: InvestmentStatementEntryKind;
  credit: number;
  debit: number;
  amount: number;
  balance: number;
  document?: string;
  sequence: number;
  rawTokens: string[];
}

export interface ViacrediInvestmentStatement {
  institutionName: 'VIACREDI';
  productName: 'APLICACAO_PROGRAMADA';
  contractNumber?: string;
  purpose?: string;
  periodStart: string;
  periodEnd: string;
  openingBalanceDate?: string;
  openingBalance: number;
  finalBalance: number;
  entries: InvestmentStatementEntry[];
  monthlyApplications: InvestmentStatementEntry[];
  monthlyIncomeProvisions: InvestmentStatementEntry[];
  incomeTaxDebits: InvestmentStatementEntry[];
  dailyBalances: Record<string, number>;
  rawTextTokens: string[];
}

export type AccountStatementMatchStatus = 'matched' | 'missing_statement' | 'review';

export interface AccountStatementMatch {
  account: QuestorTrialBalanceAccount;
  ledgerAccount?: QuestorLedgerAccount;
  statement?: ViacrediStatement;
  investmentStatement?: ViacrediInvestmentStatement;
  status: AccountStatementMatchStatus;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reason: string;
}

export type BankReconciliationStatus =
  | 'reconciled'
  | 'divergent'
  | 'missing_statement'
  | 'missing_ledger'
  | 'investment_statement_parsed'
  | 'insufficient_data';

export interface BalanceCheckpoint {
  date: string;
  statementBalance: number;
  ledgerBalance?: number;
  ledgerBalanceDate?: string;
  difference?: number;
  matches: boolean;
}

export type SuggestedBankingEntryKind = 'investment_income' | 'investment_income_tax';

export interface SuggestedBankingEntry {
  id: string;
  kind: SuggestedBankingEntryKind;
  date: string;
  debitAccountCode?: string;
  debitAccountName: string;
  creditAccountCode?: string;
  creditAccountName: string;
  amount: number;
  history: string;
  sourceDescription: string;
}

export interface BalanceReconciliationResult {
  accountCode: string;
  accountName: string;
  accountKind: BankAccountKind;
  status: BankReconciliationStatus;
  periodStart?: string;
  periodEnd?: string;
  checkpoints?: BalanceCheckpoint[];
  finalCheckpoint?: BalanceCheckpoint;
  lastMatchedCheckpoint?: BalanceCheckpoint;
  firstDivergentCheckpoint?: BalanceCheckpoint;
  difference?: number;
  ledgerEntriesOnDivergenceDate: QuestorLedgerEntry[];
  statementEntriesOnDivergenceDate: BankStatementEntry[];
  investmentEntriesOnDivergenceDate?: InvestmentStatementEntry[];
  suggestedEntries?: SuggestedBankingEntry[];
  message: string;
}

export type BankingReviewItemKind =
  | 'missing_statement'
  | 'missing_ledger'
  | 'divergence_check'
  | 'suggested_entry'
  | 'insufficient_data';

export type BankingReviewItemStatus = 'open' | 'approved' | 'done' | 'ignored';

export interface BankingReviewItem {
  id: string;
  kind: BankingReviewItemKind;
  status: BankingReviewItemStatus;
  accountCode: string;
  accountName: string;
  periodStart?: string;
  periodEnd?: string;
  title: string;
  detail: string;
  amount?: number;
  dueDate?: string;
  candidateDescription?: string;
  suggestedEntryId?: string;
  note?: string;
  updatedAt?: string;
}
