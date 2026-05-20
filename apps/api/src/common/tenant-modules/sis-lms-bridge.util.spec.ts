import {
  buildSisLmsBridgeWhenBothModules,
  mergeSisLmsBridgeIntoSettings,
  readSisLmsBridgeSettings,
} from './sis-lms-bridge.util';

describe('sis-lms-bridge.util', () => {
  it('enables bridge when both SIS and LMS are on', () => {
    const bridge = buildSisLmsBridgeWhenBothModules(true, true);
    expect(bridge.enabled).toBe(true);
    expect(bridge.enrollmentLinkedAccess).toBe(true);
  });

  it('disables bridge when only one module is on', () => {
    expect(buildSisLmsBridgeWhenBothModules(true, false).enabled).toBe(false);
    expect(buildSisLmsBridgeWhenBothModules(false, true).enabled).toBe(false);
  });

  it('round-trips through institution settings', () => {
    const merged = mergeSisLmsBridgeIntoSettings({}, buildSisLmsBridgeWhenBothModules(true, true));
    expect(readSisLmsBridgeSettings(merged).enabled).toBe(true);
  });
});
