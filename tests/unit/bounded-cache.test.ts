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

  test('keeps retained entries warm when evicting at the limit', () => {
    const cache = new BoundedStringCache<number>(2);
    const createdKeys: string[] = [];
    const createValue =
      (key: string, value: number): (() => number) =>
      () => {
        createdKeys.push(key);

        return value;
      };

    expect(cache.getOrSet('first', createValue('first', 1))).toBe(1);
    expect(cache.getOrSet('second', createValue('second', 2))).toBe(2);
    expect(cache.get('first')).toEqual({ hit: true, value: 1 });
    expect(cache.getOrSet('third', createValue('third', 3))).toBe(3);

    expect(cache.getOrSet('first', createValue('first', 10))).toBe(1);
    expect(cache.getOrSet('third', createValue('third', 30))).toBe(3);
    expect(cache.getOrSet('second', createValue('second', 20))).toBe(20);
    expect(createdKeys).toEqual(['first', 'second', 'third', 'second']);
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

  test('replaces existing entries without evicting newer entries', () => {
    const cache = new BoundedStringCache<number>(2);

    cache.set('first', 1);
    cache.set('second', 2);
    cache.set('first', 10);

    expect(cache.get('first')).toEqual({ hit: true, value: 10 });
    expect(cache.get('second')).toEqual({ hit: true, value: 2 });

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('first')).toEqual({ hit: false });
    expect(cache.get('second')).toEqual({ hit: false });
  });

  test('rejects invalid cache limits', () => {
    expect(() => new BoundedStringCache<string>(0)).toThrow('positive integer');
  });
});
