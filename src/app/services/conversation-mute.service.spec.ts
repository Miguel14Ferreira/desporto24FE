import { isConversationMuted } from './conversation-mute.service';

describe('Per-conversation notification muting', () => {
  const mutes = [
    {kind:'direct' as const,id:'bea'},
    {kind:'community' as const,id:'12'},
    {kind:'private' as const,id:'7'}
  ];
  it('keeps different chats and types independent', () => {
    expect(isConversationMuted(mutes, 'direct', 'Bea')).toBeTrue();
    expect(isConversationMuted(mutes, 'direct', 'ana')).toBeFalse();
    expect(isConversationMuted(mutes, 'community', 12)).toBeTrue();
    expect(isConversationMuted(mutes, 'session', 12)).toBeFalse();
    expect(isConversationMuted(mutes, 'private', 7)).toBeTrue();
    expect(isConversationMuted([], 'private', 7)).toBeFalse();
    expect(isConversationMuted(null, 'direct', 'bea')).toBeFalse();
  });
});
