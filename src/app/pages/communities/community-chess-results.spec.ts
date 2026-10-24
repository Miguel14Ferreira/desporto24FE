import { chessGameError, chessGameScore } from './community-chess-results';
import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent } from './community-round-event-type';

describe('Chess — played games only', () => {
  const p = (team: string, result: 'WIN' | 'DRAW' | 'LOSS') => ({team,result});
  it('uses only the preexisting Chess catalogue sport and a neutral individual event', () => {
    expect(eventOptionsForSport('Xadrez').map(x=>x.code)).toEqual(['CHESS_GAME']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isNeutralEvent('Xadrez','CHESS_GAME')).toBeTrue();
    expect(eventPresentationFormat('Xadrez','CHESS_GAME')).toBe('duel');
  });
  it('accepts White wins, Black wins and drawn games', () => {
    expect(chessGameError([p('WHITE','WIN'),p('BLACK','LOSS')])).toBeFalse();
    expect(chessGameError([p('WHITE','LOSS'),p('BLACK','WIN')])).toBeFalse();
    expect(chessGameError([p('WHITE','DRAW'),p('BLACK','DRAW')])).toBeFalse();
    expect(chessGameScore('WIN')).toBe('1');
    expect(chessGameScore('DRAW')).toBe('½');
    expect(chessGameScore('LOSS')).toBe('0');
  });
  it('rejects missing/repeated colors, mismatched results and extra players', () => {
    expect(chessGameError([p('WHITE','WIN')])).toBeTrue();
    expect(chessGameError([p('WHITE','WIN'),p('WHITE','LOSS')])).toBeTrue();
    expect(chessGameError([p('WHITE','WIN'),p('BLACK','DRAW')])).toBeTrue();
    expect(chessGameError([p('WHITE','DRAW'),p('BLACK','LOSS')])).toBeTrue();
    expect(chessGameError([p('WHITE','WIN'),p('BLACK','LOSS'),p('BLACK','LOSS')])).toBeTrue();
  });
});
