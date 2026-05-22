import { extractTokensFromPdf } from './pdf-token-extractor';
import { parseViacrediInvestmentStatementTextTokens } from './viacredi-investment-statement-parser';
import { parseViacrediStatementTextTokens } from './viacredi-statement-parser';
import type { ViacrediInvestmentStatement, ViacrediStatement } from './types';
import { normalizeText } from './questor-utils';

export type ParsedViacrediPdf =
  | {
      type: 'checking_statement';
      statement: ViacrediStatement;
      fileName?: string;
    }
  | {
      type: 'investment_statement';
      statement: ViacrediInvestmentStatement;
      fileName?: string;
    };

export function parseViacrediDocumentTextTokens(tokens: string[], fileName?: string): ParsedViacrediPdf {
  const joined = normalizeText(tokens.join(' '));

  if (joined.includes('extrato aplicacao programada')) {
    return {
      type: 'investment_statement',
      statement: parseViacrediInvestmentStatementTextTokens(tokens),
      fileName,
    };
  }

  return {
    type: 'checking_statement',
    statement: parseViacrediStatementTextTokens(tokens),
    fileName,
  };
}

export async function parseViacrediDocumentPdf(file: File): Promise<ParsedViacrediPdf> {
  return parseViacrediDocumentTextTokens(await extractTokensFromPdf(file), file.name);
}
