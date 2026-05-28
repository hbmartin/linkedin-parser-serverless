import { BoundedStringCache } from '../../src/utils/bounded-cache.js';

describe('BoundedStringCache', () => {
  test('evicts only the oldest entry when the limit is reached', () => {
    const cache = new BoundedStringCache<number>(2);

    cache.set('first', 1);
    cache.set('second', 2);

    expect(cache.get('first')).toEqual({ hit: true, value: 1 });

    cache.set('third', 3);

    expect(cache.get('second')).toEqual({ hit: false });
    expect(cache.get('first')).toEqual({ hit: true, value: 1 });
    expect(cache.get('third')).toEqual({ hit: true, value: 3 });
    expect(cache.size).toBe(2);
  });

  test('caches undefined values without recomputing them', () => {
    const cache = new BoundedStringCache<string | undefined>(2);
    let createCalls = 0;
    const createValue = (): string | undefined => {
      createCalls += 1;

      return undefined;
    };

    expect(cache.getOrSet('missing', createValue)).toBeUndefined();
    expect(cache.getOrSet('missing', createValue)).toBeUndefined();
    expect(createCalls).toBe(1);
  });

  test('rejects invalid cache limits', () => {
    expect(() => new BoundedStringCache<string>(0)).toThrow('positive integer');
  });
});
