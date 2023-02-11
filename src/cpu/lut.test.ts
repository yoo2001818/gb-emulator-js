import { generateLUTRules, generateLUTSingle } from './lut';

describe('generateLUTSingle', () => {
  it('should generate LUT', () => {
    const genFn = jest.fn(({ a, b }) => a + b);
    const result = generateLUTSingle('aa01bb', genFn);
    expect(genFn).toBeCalledTimes(16);
    expect(result[0x07]).toBe(3);
    expect(result[0x37]).toBe(6);
    expect(result[0x04]).toBe(0);
  });
});

describe('generateLUTRules', () => {
  it('should generate LUT', () => {
    const genFn1 = jest.fn(({ a, b }) => a + b);
    const genFn2 = jest.fn(() => 9999);
    const result = generateLUTRules(0, [
      ['aabb', genFn1],
      ['1000', genFn2],
    ]);
    expect(genFn1).toBeCalledTimes(16);
    expect(genFn2).toBeCalledTimes(1);
    expect(result[0x07]).toBe(4);
    expect(result[0x04]).toBe(1);
    expect(result[0x08]).toBe(9999);
  });
});

