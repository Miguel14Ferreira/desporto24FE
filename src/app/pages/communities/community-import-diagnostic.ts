import { appTranslate as t } from '../../i18n/i18n.service';
import type { CommunityImportDiagnostic } from '../../services/community-groups.service';

/**
 * The import API currently returns human-readable Portuguese diagnostics.
 * Translate only known diagnostic templates, retaining all row numbers, field
 * identifiers, source names and values. Never alter the API response or file.
 * For unrecognised messages, use a safe English review prompt rather than
 * leaking untranslated Portuguese (or exposing arbitrary backend details).
 */
const patterns: ReadonlyArray<{ match: RegExp; key: string; values: readonly string[] }> = [
  { match: /^A folha selecionada não existe$/u, key: 'communities.import.diagnostic.sheetMissing', values: [] },
  { match: /^A coluna (\d+) não existe na folha$/u, key: 'communities.import.diagnostic.columnMissing', values: ['column'] },
  { match: /^Campo não suportado: (.+)$/u, key: 'communities.import.diagnostic.unsupportedField', values: ['field'] },
  { match: /^Campo repetido: (.+)$/u, key: 'communities.import.diagnostic.duplicateField', values: ['field'] },
  { match: /^Seleciona uma coluna para identificar o jogador$/u, key: 'communities.import.diagnostic.playerColumn', values: [] },
  { match: /^A folha não contém linhas de dados$/u, key: 'communities.import.diagnostic.emptySheet', values: [] },
  { match: /^Linha (\d+): confronto potencialmente repetido; verifica se é um jogo diferente antes de confirmar$/u,
    key: 'communities.import.diagnostic.duplicateMatch', values: ['row'] },
  { match: /^Linha (\d+): jogador (.+) repetido na jornada (.+); será ignorado \(mantida a primeira ocorrência\)$/u,
    key: 'communities.import.diagnostic.duplicateRoundPlayer', values: ['row', 'player', 'round'] },
  { match: /^Linha (\d+): (.+) repetido; mantém-se apenas a primeira ocorrência$/u,
    key: 'communities.import.diagnostic.duplicateStanding', values: ['row', 'name'] },
  { match: /^Linha (\d+): jogador vazio$/u, key: 'communities.import.diagnostic.playerEmpty', values: ['row'] },
  { match: /^Linha (\d+): (\w+) exige um número inteiro válido \('([\s\S]*)'\)$/u,
    key: 'communities.import.diagnostic.integerRequired', values: ['row', 'field', 'value'] },
  { match: /^Linha (\d+): os resultados V\/E\/D ou o campo RESULT são contraditórios$/u,
    key: 'communities.import.diagnostic.conflictingResults', values: ['row'] }
];

/**
 * Prefer machine-readable API codes whenever provided; older backends still
 * return the legacy messages, which the existing strict patterns can translate.
 * Unknown codes deliberately never fall through to an arbitrary backend string.
 */
const diagnosticCodeKeys: Record<string, string> = {
  IMPORT_SHEET_MISSING: 'communities.import.diagnostic.sheetMissing',
  IMPORT_COLUMN_MISSING: 'communities.import.diagnostic.columnMissing',
  IMPORT_UNSUPPORTED_FIELD: 'communities.import.diagnostic.unsupportedField',
  IMPORT_DUPLICATE_FIELD: 'communities.import.diagnostic.duplicateField',
  IMPORT_PLAYER_COLUMN_REQUIRED: 'communities.import.diagnostic.playerColumn',
  IMPORT_EMPTY_SHEET: 'communities.import.diagnostic.emptySheet',
  IMPORT_DUPLICATE_MATCH: 'communities.import.diagnostic.duplicateMatch',
  IMPORT_DUPLICATE_ROUND_PLAYER: 'communities.import.diagnostic.duplicateRoundPlayer',
  IMPORT_DUPLICATE_STANDING: 'communities.import.diagnostic.duplicateStanding',
  IMPORT_EMPTY_PLAYER: 'communities.import.diagnostic.playerEmpty',
  IMPORT_INTEGER_REQUIRED: 'communities.import.diagnostic.integerRequired',
  IMPORT_CONFLICTING_RESULTS: 'communities.import.diagnostic.conflictingResults',
  IMPORT_FILE_REQUIRED: 'communities.import.diagnostic.fileRequired',
  IMPORT_FILE_TOO_LARGE: 'communities.import.diagnostic.fileTooLarge',
  IMPORT_FILE_FORMAT_UNSUPPORTED: 'communities.import.diagnostic.fileUnsupported',
  IMPORT_FILE_READ_FAILED: 'communities.import.diagnostic.fileReadFailed',
  IMPORT_FILE_NAME_INVALID: 'communities.import.diagnostic.fileNameInvalid',
  IMPORT_MAPPING_INVALID: 'communities.import.diagnostic.mappingInvalid',
  IMPORT_ROW_SCORE_INVALID: 'communities.import.diagnostic.rowScoreInvalid',
  IMPORT_ROW_SCORE_RANGE: 'communities.import.diagnostic.rowScoreRange',
  IMPORT_ROW_OPPONENTS_INVALID: 'communities.import.diagnostic.rowOpponentsInvalid',
  IMPORT_ROW_SELF_MATCH: 'communities.import.diagnostic.rowSelfMatch',
  IMPORT_SOURCE_DATE_INVALID: 'communities.import.diagnostic.sourceDateInvalid'
};

function safeDiagnosticTranslation(key: string, params: Record<string, string>, fallbackKey: string): string {
  const translated = t(key, params);
  // A newer API can add codes or omit parameters. Never display raw
  // interpolation markers such as {{row}} in import validation feedback.
  return /\{\{[^{}]+\}\}/.test(translated) ? t(fallbackKey) : translated;
}

export function importDiagnosticLabel(source: unknown, detail?: CommunityImportDiagnostic | null): string {
  if (typeof source !== 'string' || source.trim().length === 0) {
    return t('communities.import.diagnostic.unknown');
  }
  if (typeof localStorage === 'undefined' || localStorage.getItem('d24-language') !== 'en') {
    return source;
  }
  if (detail && typeof detail.code === 'string') {
    const params: Record<string, string> = {};
    if (detail.params && typeof detail.params === 'object' && !Array.isArray(detail.params)) {
      for (const [name, value] of Object.entries(detail.params)) {
        if (typeof value === 'string') params[name] = value;
      }
    }
    const key = Object.prototype.hasOwnProperty.call(diagnosticCodeKeys, detail.code)
      ? diagnosticCodeKeys[detail.code] : undefined;
    if (key) return safeDiagnosticTranslation(key, params, 'communities.import.diagnostic.unknown');
    const row = params['row'];
    return typeof row === 'string' && /^\d+$/.test(row)
      ? t('communities.import.diagnostic.unknownRow', { row })
      : t('communities.import.diagnostic.unknown');
  }
  const message = source.trim();
  for (const rule of patterns) {
    const groups = rule.match.exec(message);
    if (!groups) continue;
    const values: Record<string, string> = {};
    rule.values.forEach((name, index) => { values[name] = groups[index + 1]; });
    return safeDiagnosticTranslation(rule.key, values, 'communities.import.diagnostic.unknown');
  }
  const row = /^Linha (\d+)(?::|$)/u.exec(message);
  return row
    ? t('communities.import.diagnostic.unknownRow', { row: row[1] })
    : t('communities.import.diagnostic.unknown');
}

/**
 * Prefer structured HTTP import validation errors when supported by the API.
 * Older APIs have only a Portuguese message, which remains visible in PT.
 * Unknown codes/messages use the operation-specific translation in EN.
 */
export function importHttpErrorLabel(error: unknown, fallbackKey: string): string {
  const payload = (error && typeof error === 'object' && 'error' in error)
    ? (error as { error?: unknown }).error : undefined;
  const response = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as { message?: unknown; code?: unknown; params?: unknown } : null;
  const message = response?.message;
  const english = typeof localStorage !== 'undefined' && localStorage.getItem('d24-language') === 'en';

  if (!english) {
    return typeof message === 'string' && message.trim().length > 0 && message.length <= 240
      ? message : t(fallbackKey);
  }
  const code = response?.code;
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(diagnosticCodeKeys, code)) {
    const params: Record<string, string> = {};
    const source = response?.params;
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      for (const [name, value] of Object.entries(source)) {
        if (typeof value === 'string') params[name] = value;
      }
    }
    return safeDiagnosticTranslation(diagnosticCodeKeys[code], params, fallbackKey);
  }
  return t(fallbackKey);
}
