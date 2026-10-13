import 'fake-indexeddb/auto';
import { openDb } from '../js/db.js';

let counter = 0;

/** Apre un database nuovo e vuoto (nome unico per ogni test). */
export async function freshDb(migrations) {
  const name = `test-db-${process.pid}-${++counter}`;
  return openDb(name, migrations);
}
