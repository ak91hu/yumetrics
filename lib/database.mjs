import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import pg from 'pg';

export function openDatabase(filename) {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY);');
  const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  for (const { tag } of journal.entries) {
    if (sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(tag)) continue;
    sqlite.exec('BEGIN IMMEDIATE');
    try { sqlite.exec(readFileSync(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8')); sqlite.prepare('INSERT INTO schema_migrations VALUES(?)').run(tag); sqlite.exec('COMMIT'); }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }
  let transactionTail = Promise.resolve();
  const db = {
    dialect: 'sqlite',
    prepare(sql) { const statement = sqlite.prepare(sql); return { bind(...args) { return {
      async first() { return statement.get(...args) || null; }, async all() { return { results: statement.all(...args) }; },
      async run() { return { meta: { changes: statement.run(...args).changes } }; },
    }; } }; },
    async transaction(fn) { const previous = transactionTail; let unlock; transactionTail = new Promise(resolve => { unlock = resolve; }); await previous; sqlite.exec('BEGIN IMMEDIATE'); try { const result = await fn(db); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } finally { unlock(); } },
    async close() { sqlite.close(); },
  };
  return db;
}
function postgresAdapter(client) {
  return {
    dialect: 'postgres',
    prepare(sql) {
      // Application statements are fixed SQL without literal question marks; only bind markers are translated.
      let index = 0; const query = sql.replace(/\?/g, () => `$${++index}`);
      return { bind(...args) { return {
        async first() { return (await client.query(query, args)).rows[0] || null; },
        async all() { return { results: (await client.query(query, args)).rows }; },
        async run() { return { meta: { changes: (await client.query(query, args)).rowCount } }; },
      }; } };
    },
  };
}
export async function openPostgresDatabase(connectionString) {
  if (!/^postgres(?:ql)?:\/\//.test(connectionString || '')) throw new Error('DATABASE_URL: Northflank PostgreSQL kapcsolat szükséges.');
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, statement_timeout: 30_000, options: '-c synchronous_commit=on' });
  pool.on('error', error => console.error('PostgreSQL connection error:', error.code || error.name));
  let client;
  try { client = await pool.connect(); } catch (error) { await pool.end(); throw error; }
  let migrationError;
  try {
    await client.query('SELECT pg_advisory_lock(14830, 301)');
    await client.query('BEGIN');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY)');
    const name = 'postgres/0001_initial';
    if (!(await client.query('SELECT name FROM schema_migrations WHERE name=$1', [name])).rowCount) {
      await client.query(readFileSync(new URL('../postgres/0001_initial.sql', import.meta.url), 'utf8'));
      await client.query('INSERT INTO schema_migrations VALUES($1)', [name]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); migrationError = error; }
  finally { await client.query('SELECT pg_advisory_unlock(14830, 301)').catch(() => {}); client.release(); }
  if (migrationError) { await pool.end(); throw migrationError; }
  const db = postgresAdapter(pool);
  db.transaction = async fn => {
    const connection = await pool.connect();
    try { await connection.query('BEGIN'); const result = await fn(postgresAdapter(connection)); await connection.query('COMMIT'); return result; }
    catch (error) { await connection.query('ROLLBACK'); throw error; } finally { connection.release(); }
  };
  db.close = () => pool.end();
  return db;
}
