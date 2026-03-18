import { describe, it, expect } from 'vitest';
import vi from '../../messages/vi.json';
import en from '../../messages/en.json';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject { [key: string]: JsonValue }

function extractKeys(obj: JsonObject, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      keys.push(...extractKeys(val as JsonObject, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function findEmptyValues(obj: JsonObject, prefix = ''): string[] {
  const empties: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      empties.push(...findEmptyValues(val as JsonObject, fullKey));
    } else if (val === '') {
      empties.push(fullKey);
    }
  }
  return empties;
}

describe('Translation key parity', () => {
  const viKeys = extractKeys(vi as unknown as JsonObject).sort();
  const enKeys = extractKeys(en as unknown as JsonObject).sort();

  it('vi.json and en.json have identical key structure', () => {
    expect(viKeys).toEqual(enKeys);
  });

  it('vi.json has no empty string values', () => {
    const empty = findEmptyValues(vi as unknown as JsonObject);
    expect(empty).toEqual([]);
  });

  it('en.json has no empty string values', () => {
    const empty = findEmptyValues(en as unknown as JsonObject);
    expect(empty).toEqual([]);
  });
});
