import { parseMinutesJson } from './ai-meetings-minutes.service';

describe('parseMinutesJson', () => {
  it('parses JSON from model text', () => {
    const minutes = parseMinutesJson(
      'Here are the minutes:\n{"attendees":[{"name":"Chair"}],"agendaItems":[],"actionItems":[],"summary":"Done"}',
    );
    expect(minutes.attendees).toHaveLength(1);
    expect(minutes.summary).toBe('Done');
  });
});
