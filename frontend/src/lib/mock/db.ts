import type {
  BulkRequirement,
  Cart,
  Category,
  Forecast,
  Order,
  Payment,
  Product,
  ProductListing,
  Recommendation,
  Review,
  ServiceArea,
} from '@/types';
import { MockUser } from './types';

const DB_KEY = 'vaikkal-mock-db-v1';
const DB_VERSION = 1;

import type { MockDB } from './types';
import { buildSeedDB } from './seed';

export type { MockDB, MockUser, SeedProduct } from './types';

let cache: MockDB | null = null;

export function loadDB(): MockDB {
  if (cache) return cache;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDB;
        if (parsed.version === DB_VERSION) {
          cache = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }
  const fresh = buildSeedDB();
  cache = fresh;
  if (typeof window !== 'undefined') {
    persistDB(fresh);
  }
  return fresh;
}

export function persistDB(db: MockDB): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // ignore quota errors
  }
}

export function saveDB(mutator: (db: MockDB) => void): MockDB {
  const db = loadDB();
  mutator(db);
  persistDB(db);
  return db;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}