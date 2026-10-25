import { importDiagnosticLabel } from './community-import-diagnostic';

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
});
