import { restorePendingSends, savePendingSends } from './pending-send-session';

describe('Tab-scoped uncertain chat send recovery', () => {
  const account = 'ana';
  const token = 'local-synthetic-bearer-never-written';
  const key = 'jynlo.chat.uncertain-posts.v1';
  const pending = () => ({
    key:'direct:bea', text:'A mesma mensagem após F5',
    replyToMessageId:null,knownIds:new Set([12,13]),startedAt:Date.now()
  });

  beforeEach(() => sessionStorage.removeItem(key));
  afterEach(() => sessionStorage.removeItem(key));

  it('preserves send identity and message text in this tab without storing bearer tokens', () => {
    savePendingSends(account, token, [pending()]);
    const raw = sessionStorage.getItem(key)!;
    expect(raw).toContain('A mesma mensagem após F5');
    expect(raw).not.toContain(token);
    const restored = restorePendingSends(account, token);
    expect(restored).toHaveSize(1);
    expect(restored[0].key).toBe('direct:bea');
    expect(restored[0].knownIds).toEqual(new Set([12,13]));
    expect(restored[0].replyToMessageId).toBeNull();
  });

  it('deletes the old account data if a different user signs in', () => {
    savePendingSends(account, token, [pending()]);
    expect(restorePendingSends('carla', token)).toEqual([]);
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(restorePendingSends(account, token)).toEqual([]);
  });

  it('does not inherit a draft after logout and new authentication of the same user', () => {
    savePendingSends(account, token, [pending()]);
    expect(restorePendingSends(account, token + '-new-login')).toEqual([]);
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it('drops expired messages, invalid conversation IDs and corrupt storage', () => {
    savePendingSends(account, token, [{...pending(),startedAt:Date.now()-25*3600_000}]);
    expect(sessionStorage.getItem(key)).toBeNull();
    savePendingSends(account, token, [{...pending(),key:'session:0'}]);
    expect(sessionStorage.getItem(key)).toBeNull();
    savePendingSends(account, token, [pending()]);
    const parsed=JSON.parse(sessionStorage.getItem(key)!);
    parsed.entries[0].key='community:-1';
    sessionStorage.setItem(key,JSON.stringify(parsed));
    expect(restorePendingSends(account,token)).toEqual([]);
    expect(sessionStorage.getItem(key)).toBeNull();
    sessionStorage.setItem(key,'{invalid');
    expect(restorePendingSends(account,token)).toEqual([]);
  });

  it('removes confirmed or manually cleared sends, keeping other pending threads', () => {
    const other={...pending(),key:'community:7',text:'Novo jogo'};
    savePendingSends(account,token,[pending(),other]);
    expect(restorePendingSends(account,token)).toHaveSize(2);
    savePendingSends(account,token,[other]);
    expect(restorePendingSends(account,token).map(item=>item.key)).toEqual(['community:7']);
    savePendingSends(account,token,[]);
    expect(sessionStorage.getItem(key)).toBeNull();
  });
});
