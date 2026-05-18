import {
  meetingMinutesToDocxBuffer,
  meetingMinutesToPdfBuffer,
} from './meetings-minutes-export.util';

describe('meetings-minutes-export.util', () => {
  it('builds PDF minutes', async () => {
    const pdf = await meetingMinutesToPdfBuffer('Senate', 'Item 1\nDecision recorded.');
    expect(pdf.byteLength).toBeGreaterThan(100);
  });

  it('builds DOCX minutes', async () => {
    const docx = await meetingMinutesToDocxBuffer('Senate', 'Item 1\nDecision recorded.');
    expect(docx.length).toBeGreaterThan(100);
    expect(docx.subarray(0, 2).toString()).toBe('PK');
  });
});
