import type { ViacrediStatement } from './types';
import { extractTokensFromPdf } from './pdf-token-extractor';
import { parseViacrediStatementTextTokens } from './viacredi-statement-parser';

export async function parseViacrediStatementPdf(
  fileOrBuffer: File | ArrayBuffer,
): Promise<ViacrediStatement> {
  return parseViacrediStatementTextTokens(await extractTokensFromPdf(fileOrBuffer));
}

export { parseViacrediStatementTextTokens };
