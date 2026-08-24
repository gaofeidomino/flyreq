import { type CacheEntry, type CacheStore, isExpired, warnUnavailable } from '../types'
import { createMemoryStore } from './memory'

interface SqlResultSet {
  rows: {
    length: number
    item: (i: number) => { k: string, v: string }
  }
}

interface SqlTransaction {
  executeSql: (
    sql: string,
    args?: unknown[],
    success?: (tx: SqlTransaction, result: SqlResultSet) => void,
    error?: (tx: SqlTransaction, err: { message?: string }) => boolean,
  ) => void
}

interface WebSQLDatabase {
  transaction: (
    callback: (tx: SqlTransaction) => void,
    error?: (err: { message?: string }) => void,
    success?: () => void,
  ) => void
}

type OpenDatabase = (
  name: string,
  version: string,
  displayName: string,
  size: number,
) => WebSQLDatabase

const DB_NAME = 'flyreq-cache'
const TABLE = 'cache'

function getOpenDatabase(): OpenDatabase | undefined {
  const g = globalThis as unknown as { openDatabase?: OpenDatabase }
  return typeof g.openDatabase === 'function' ? g.openDatabase.bind(g) : undefined
}

function exec(
  db: WebSQLDatabase,
  sql: string,
  args: unknown[] = [],
): Promise<SqlResultSet | undefined> {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          sql,
          args,
          (_t, result) => resolve(result),
          (_t, err) => {
            reject(new Error(err.message ?? 'WebSQL error'))
            return false
          },
        )
      },
      (err) => reject(new Error(err.message ?? 'WebSQL transaction error')),
    )
  })
}

/** WebSQL backend (deprecated in browsers; kept as a CacheStore adapter). */
export function createWebSQLStore(): CacheStore {
  const openDatabase = getOpenDatabase()
  if (!openDatabase) {
    warnUnavailable('WebSQL')
    return createMemoryStore()
  }

  const db = openDatabase(DB_NAME, '1.0', 'flyreq cache', 5 * 1024 * 1024)
  const ready = exec(
    db,
    `CREATE TABLE IF NOT EXISTS ${TABLE} (k TEXT PRIMARY KEY, v TEXT)`,
  ).then(() => undefined)

  async function readEntry(key: string): Promise<CacheEntry | undefined> {
    await ready
    const result = await exec(db, `SELECT v FROM ${TABLE} WHERE k = ?`, [key])
    if (!result || result.rows.length === 0) return undefined
    try {
      return JSON.parse(result.rows.item(0).v) as CacheEntry
    }
    catch {
      await exec(db, `DELETE FROM ${TABLE} WHERE k = ?`, [key])
      return undefined
    }
  }

  return {
    async has(key) {
      const entry = await readEntry(key)
      if (!entry) return false
      if (isExpired(entry.meta)) {
        await exec(db, `DELETE FROM ${TABLE} WHERE k = ?`, [key])
        return false
      }
      return true
    },
    async get<T>(key: string) {
      const entry = await readEntry(key)
      if (!entry) return undefined
      if (isExpired(entry.meta)) {
        await exec(db, `DELETE FROM ${TABLE} WHERE k = ?`, [key])
        return undefined
      }
      return entry.value as T
    },
    async set(key, value, meta) {
      await ready
      const entry: CacheEntry = { value, meta }
      await exec(
        db,
        `INSERT OR REPLACE INTO ${TABLE} (k, v) VALUES (?, ?)`,
        [key, JSON.stringify(entry)],
      )
    },
    async delete(key) {
      await ready
      await exec(db, `DELETE FROM ${TABLE} WHERE k = ?`, [key])
    },
    async clear() {
      await ready
      await exec(db, `DELETE FROM ${TABLE}`)
    },
  }
}
