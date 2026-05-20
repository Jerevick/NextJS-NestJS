import { applyStudentNumberFormat } from './student-number-format.util';

describe('applyStudentNumberFormat', () => {
  it('supports [SEQ:N] and YYYY tokens', () => {
    expect(applyStudentNumberFormat('EXT/YYYY/[SEQ:4]', { year: 2026, code: 'CS', seq: 7 })).toBe(
      'EXT/2026/0007',
    );
  });

  it('supports legacy {year}/{code}/{seq}', () => {
    expect(
      applyStudentNumberFormat('{year}/{code}/{seq}', { year: 2025, code: 'ENG', seq: 12 }),
    ).toBe('2025/ENG/012');
  });
});
