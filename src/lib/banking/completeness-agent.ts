import {
  buildBankLikeAccountsFromLedger,
  matchBankAccountsToStatements,
} from './account-statement-matcher';
import type { ClassificationSummary } from './file-classifier-agent';

export interface MissingStatement {
  accountCode: string;
  accountName: string;
}

export type CompletenessResult =
  | { ready: true; matchedAccounts: number; inferredFromLedger: boolean; warningText?: string }
  | {
      ready: false;
      canProceed: boolean;
      missingTrialBalance: boolean;
      missingLedger: boolean;
      missingStatements: MissingStatement[];
      questionText: string;
      proceedText?: string;
    };

function statementCount(summary: ClassificationSummary): number {
  return summary.checkingStatements.length + summary.investmentStatements.length;
}

function hasAnyStatement(summary: ClassificationSummary): boolean {
  return statementCount(summary) > 0;
}

function buildMissingBaseText(summary: ClassificationSummary): CompletenessResult {
  const hasStatement = hasAnyStatement(summary);

  if (!hasStatement && !summary.trialBalance && !summary.ledger) {
    return {
      ready: false,
      canProceed: false,
      missingTrialBalance: true,
      missingLedger: true,
      missingStatements: [],
      questionText:
        'Ainda não identifiquei os documentos da conciliação. Envie o Razão Questor e pelo menos um extrato bancário. O balancete ajuda a validar as contas analíticas, mas não é obrigatório quando o Razão estiver disponível.',
    };
  }

  if (!summary.ledger && !summary.trialBalance && hasStatement) {
    return {
      ready: false,
      canProceed: false,
      missingTrialBalance: true,
      missingLedger: true,
      missingStatements: [],
      questionText:
        'Recebi o extrato, mas ainda não tenho o Lado A da conciliação. Envie o Razão Questor para comparar os saldos. Se quiser, envie também o balancete para validar quais contas são analíticas.',
    };
  }

  if (!summary.ledger && summary.trialBalance && hasStatement) {
    return {
      ready: false,
      canProceed: false,
      missingTrialBalance: false,
      missingLedger: true,
      missingStatements: [],
      questionText:
        'Recebi o balancete e o extrato. Para conciliar de verdade ainda preciso do Razão Questor, porque é nele que ficam os saldos diários e lançamentos usados na comparação.',
    };
  }

  if (summary.ledger && !hasStatement) {
    return {
      ready: false,
      canProceed: false,
      missingTrialBalance: !summary.trialBalance,
      missingLedger: false,
      missingStatements: [],
      questionText:
        'Recebi o Razão Questor. Agora envie o extrato bancário em PDF para montar o Lado B e comparar os saldos.',
    };
  }

  return {
    ready: false,
    canProceed: false,
    missingTrialBalance: !summary.trialBalance,
    missingLedger: !summary.ledger,
    missingStatements: [],
    questionText:
      'Ainda falta informação para conciliar. O mínimo necessário é Razão Questor mais pelo menos um extrato bancário.',
  };
}

export function runCompletenessAgent(summary: ClassificationSummary): CompletenessResult {
  if (!summary.ledger || !hasAnyStatement(summary)) {
    return buildMissingBaseText(summary);
  }

  const allStatements = summary.checkingStatements.map((s) => s.result);
  const allInvestments = summary.investmentStatements.map((s) => s.result);
  const accounts =
    summary.trialBalance?.result.bankLikeAccounts ?? buildBankLikeAccountsFromLedger(summary.ledger.result);
  const inferredFromLedger = !summary.trialBalance;

  if (accounts.length === 0) {
    return {
      ready: false,
      canProceed: false,
      missingTrialBalance: !summary.trialBalance,
      missingLedger: false,
      missingStatements: [],
      questionText:
        'Recebi o Razão e o extrato, mas não consegui identificar uma conta bancária no Razão. Envie o balancete para eu localizar as contas analíticas ou confira se o Razão exportado contém a conta bancária.',
    };
  }

  const matches = matchBankAccountsToStatements(accounts, summary.ledger.result, allStatements, allInvestments);

  const matchedAccounts = matches.filter((m) => m.status !== 'missing_statement').length;
  const missingStatements: MissingStatement[] = matches
    .filter((m) => m.status === 'missing_statement')
    .map((m) => ({ accountCode: m.account.accountCode, accountName: m.account.name }));

  if (matchedAccounts > 0 && missingStatements.length === 0) {
    return {
      ready: true,
      matchedAccounts,
      inferredFromLedger,
      warningText: inferredFromLedger
        ? 'Vou conciliar usando o Razão como base contábil. O balancete não foi enviado, então a validação de contas analíticas ficará como observação.'
        : undefined,
    };
  }

  if (matchedAccounts > 0) {
    const accountList = missingStatements
      .map((a) => `${a.accountCode} - ${a.accountName}`)
      .join(', ');

    return {
      ready: false,
      canProceed: true,
      missingTrialBalance: false,
      missingLedger: false,
      missingStatements,
      questionText: `Já tenho base suficiente para conciliar ${matchedAccounts} conta(s). Também encontrei ${missingStatements.length} conta(s) bancária(s) sem extrato correspondente: ${accountList}. Deseja enviar esses extratos ou prosseguir com os documentos disponíveis?`,
      proceedText: 'Prosseguir com os disponíveis',
    };
  }

  return {
    ready: false,
    canProceed: false,
    missingTrialBalance: !summary.trialBalance,
    missingLedger: false,
    missingStatements,
    questionText:
      'Recebi o Razão e o extrato, mas não consegui ligar o extrato a nenhuma conta bancária. Envie o balancete ou confira se o nome da conta no Razão identifica o banco do extrato.',
  };
}

export function mergeSummaries(
  base: ClassificationSummary,
  incoming: ClassificationSummary,
): ClassificationSummary {
  return {
    trialBalance: incoming.trialBalance ?? base.trialBalance,
    ledger: incoming.ledger ?? base.ledger,
    checkingStatements: [
      ...base.checkingStatements,
      ...incoming.checkingStatements.filter(
        (s) => !base.checkingStatements.some((b) => b.file.name === s.file.name),
      ),
    ],
    investmentStatements: [
      ...base.investmentStatements,
      ...incoming.investmentStatements.filter(
        (s) => !base.investmentStatements.some((b) => b.file.name === s.file.name),
      ),
    ],
    unknown: [...base.unknown, ...incoming.unknown],
  };
}
