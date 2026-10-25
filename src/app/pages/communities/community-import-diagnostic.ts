import { appTranslate as t } from '../../i18n/i18n.service';

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

export function importDiagnosticLabel(source: unknown): string {
  if (typeof source !== 'string' || source.trim().length === 0) {
    return t('communities.import.diagnostic.unknown');
  }
  if (typeof localStorage === 'undefined' || localStorage.getItem('d24-language') !== 'en') {
    return source;
  }
  const message = source.trim();
  for (const rule of patterns) {
    const groups = rule.match.exec(message);
    if (!groups) continue;
    const values: Record<string, string> = {};
    rule.values.forEach((name, index) => { values[name] = groups[index + 1]; });
    return t(rule.key, values);
  }
  const row = /^Linha (\d+)(?::|$)/u.exec(message);
  return row
    ? t('communities.import.diagnostic.unknownRow', { row: row[1] })
    : t('communities.import.diagnostic.unknown');
}
