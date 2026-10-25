import { importDiagnosticLabel, importHttpErrorLabel } from './community-import-diagnostic';

describe('community historical import diagnostics PT/EN', () => {
  let originalLanguage: string | null;
  beforeEach(() => { originalLanguage = localStorage.getItem('d24-language'); });
  afterEach(() => {
    if (originalLanguage === null) localStorage.removeItem('d24-language');
    else localStorage.setItem('d24-language', originalLanguage);
  });

  it('keeps Portuguese source diagnostics and original text intact', () => {
    localStorage.setItem('d24-language', 'pt');
    const message = 'Linha 9: Miguel repetido; mantém-se apenas a primeira ocorrência';
    expect(importDiagnosticLabel(message)).toBe(message);
  });

  it('translates fixture and final standings duplicates without dropping row and name', () => {
    localStorage.setItem('d24-language', 'en');
    expect(importDiagnosticLabel('Linha 4: confronto potencialmente repetido; verifica se é um jogo diferente antes de confirmar'))
      .toBe('Row 4: possible duplicate match; check the source before confirming.');
    expect(importDiagnosticLabel('Linha 8: Equipa Azul repetido; mantém-se apenas a primeira ocorrência'))
      .toBe('Row 8: Equipa Azul appears more than once; only the first occurrence is kept.');
  });

  it('translates mapping errors and row warnings while retaining source fields', () => {
    localStorage.setItem('d24-language', 'en');
    expect(importDiagnosticLabel('A coluna 3 não existe na folha'))
      .toBe('Column 3 does not exist in the selected sheet.');
    expect(importDiagnosticLabel('Campo repetido: PLAYER'))
      .toBe('Duplicate mapped field: PLAYER.');
    expect(importDiagnosticLabel('Linha 6: GOALS exige um número inteiro válido (\'N/A\')'))
      .toBe('Row 6: GOALS requires a valid integer (\'N/A\').');
    expect(importDiagnosticLabel('Linha 5: jogador vazio'))
      .toBe('Row 5: the player name is missing.');
    expect(importDiagnosticLabel('Linha 7: os resultados V/E/D ou o campo RESULT são contraditórios'))
      .toBe('Row 7: the W/D/L values conflict with the RESULT field.');
    expect(importDiagnosticLabel('Linha 10: jogador Joana repetido na jornada 2020/21; será ignorado (mantida a primeira ocorrência)'))
      .toBe('Row 10: Joana appears again in round 2020/21; only the first occurrence is kept.');
  });

  it('never leaks an unknown Portuguese backend diagnostic in English', () => {
    localStorage.setItem('d24-language', 'en');
    expect(importDiagnosticLabel('Linha 17: Erro inesperado com dados internos'))
      .toBe('Row 17: review this warning in the original spreadsheet.');
    expect(importDiagnosticLabel('Mensagem inesperada do servidor'))
      .toBe('Review the original spreadsheet before confirming the import.');
    expect(importDiagnosticLabel(null))
      .toBe('Review the original spreadsheet before confirming the import.');
  });

  it('prefers stable codes over Portuguese text and retains source parameters', () => {
    localStorage.setItem('d24-language', 'en');
    const text = 'Este texto antigo não corresponde a nenhuma expressão conhecida';
    expect(importDiagnosticLabel(text, {
      code: 'IMPORT_DUPLICATE_STANDING', params: { row: '17', name: 'União Azul' }
    })).toBe('Row 17: União Azul appears more than once; only the first occurrence is kept.');
    expect(importDiagnosticLabel(text, {
      code: 'IMPORT_INTEGER_REQUIRED', params: { row: '12', field: 'GOALS', value: 'N/A' }
    })).toBe("Row 12: GOALS requires a valid integer ('N/A').");
  });

  it('falls back to generic English for unknown structured codes without leaking backend text', () => {
    localStorage.setItem('d24-language', 'en');
    expect(importDiagnosticLabel('Uma mensagem privada', {
      code: 'IMPORT_UNRECOGNIZED', params: { row: '32' }
    })).toBe('Row 32: review this warning in the original spreadsheet.');
    expect(importDiagnosticLabel('Outra mensagem privada', {
      code: 'SOME_NEW_IMPORT_CODE', params: {}
    })).toBe('Review the original spreadsheet before confirming the import.');
  });

  it('retains Portuguese diagnostics even if the backend supplies a stable code', () => {
    localStorage.setItem('d24-language', 'pt');
    const original = 'Linha 4: uma mensagem portuguesa original';
    expect(importDiagnosticLabel(original, {
      code: 'IMPORT_DUPLICATE_MATCH', params: { row: '4' }
    })).toBe(original);
  });

  it('shows a stable HTTP file error in English instead of the Portuguese backend message', () => {
    localStorage.setItem('d24-language', 'en');
    const request = { error: {
      httpStatusCode: 400, message: 'O ficheiro não pode ultrapassar 10 MB',
      code: 'IMPORT_FILE_TOO_LARGE', params: {}
    } };
    expect(importHttpErrorLabel(request, 'communities.import.inspectError'))
      .toBe('The file cannot exceed 10 MB.');
  });

  it('preserves the source row for a structured invalid historic score', () => {
    localStorage.setItem('d24-language', 'en');
    expect(importHttpErrorLabel({ error: {
      message: 'Mensagem antiga em português',
      code: 'IMPORT_ROW_SCORE_INVALID', params: { row: '23' }
    } }, 'communities.matches.previewError'))
      .toBe('Row 23: invalid score. Use 2-1 or 2:1, for example.');
  });

  it('keeps operation-specific EN fallbacks for unknown or legacy HTTP codes', () => {
    localStorage.setItem('d24-language', 'en');
    const request = { error: { message: 'Uma mensagem privada', code: 'IMPORT_UNRECOGNIZED' } };
    expect(importHttpErrorLabel(request, 'communities.import.inspectError'))
      .toBe('We could not analyse this file.');
    expect(importHttpErrorLabel({ error: { message: 'Uma mensagem privada' } }, 'communities.import.inspectError'))
      .toBe('We could not analyse this file.');
  });

  it('keeps the original safe Portuguese HTTP detail and handles malformed responses', () => {
    localStorage.setItem('d24-language', 'pt');
    const original = 'Linha 23: resultado inválido (exemplo: 2-1 ou 2:1)';
    expect(importHttpErrorLabel({ error: {
      message: original, code: 'IMPORT_ROW_SCORE_INVALID', params: { row: '23' }
    } }, 'communities.matches.previewError')).toBe(original);
    expect(importHttpErrorLabel({ error: { message: 'a'.repeat(300) } }, 'communities.import.inspectError'))
      .toBe('Não foi possível analisar este ficheiro.');
    expect(importHttpErrorLabel({}, 'communities.import.inspectError'))
      .toBe('Não foi possível analisar este ficheiro.');
  });

  it('uses a safe English fallback when a structured warning is missing required parameters', () => {
    localStorage.setItem('d24-language', 'en');
    expect(importDiagnosticLabel('Linha 4: erro', {
      code: 'IMPORT_DUPLICATE_STANDING', params: { row: '4' }
    })).toBe('Review the original spreadsheet before confirming the import.');
    expect(importDiagnosticLabel('Linha 4: erro', {
      code: 'IMPORT_INTEGER_REQUIRED', params: { row: '4', field: 'GOALS' }
    })).not.toContain('{{value}}');
  });

  it('uses the operation-specific English HTTP fallback when metadata is incomplete', () => {
    localStorage.setItem('d24-language', 'en');
    expect(importHttpErrorLabel({ error: {
      message: 'Linha 23: erro', code: 'IMPORT_ROW_SCORE_INVALID', params: {}
    } }, 'communities.matches.previewError')).toBe(
      'Could not preview these matches. Map Home, Away and Score (or separate scores for both sides).'
    );
  });

});
