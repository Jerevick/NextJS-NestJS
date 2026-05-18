import {
  anonymizeNamesInText,
  buildAnonymizedAliasMap,
  scrubMessagesForExternalAi,
  scrubTextForExternalAi,
} from './ai-pii.util';

describe('ai-pii.util', () => {
  it('redacts emails and institution ids', () => {
    const out = scrubTextForExternalAi(
      'Contact alice@school.edu institutionId:"inst_abc" number STU123456',
    );
    expect(out).not.toContain('alice@school.edu');
    expect(out).toContain('[email]');
    expect(out).toContain('[redacted]');
  });

  it('scrubs chat messages', () => {
    const msgs = scrubMessagesForExternalAi([
      { role: 'user', content: 'Email me at bob@test.com' },
    ]);
    expect(msgs[0]!.content).toContain('[email]');
  });

  it('anonymizes person names', () => {
    const map = buildAnonymizedAliasMap(['Alice Ng', 'Bob Lee']);
    const out = anonymizeNamesInText('Meet Alice Ng and Bob Lee', map);
    expect(out).toContain('Student A');
    expect(out).not.toContain('Alice Ng');
  });
});
