import * as SQLite from 'expo-sqlite';
import { trimQueue, acknowledge } from './trackingData';

let database;
async function db() {
  database ??= (async () => {
    const connection = await SQLite.openDatabaseAsync('backhaulbid-trip-gps.db');
    await connection.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS tracking_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS gps_queue (sampleId TEXT PRIMARY KEY, sessionId TEXT NOT NULL, payload TEXT NOT NULL);');
    return connection;
  })();
  return database;
}
const read = async (connection) => {
  const row = await connection.getFirstAsync('SELECT payload FROM tracking_state WHERE id=1');
  return row ? JSON.parse(row.payload) : null;
};
const rows = async (connection, sessionId) => (await connection.getAllAsync('SELECT payload FROM gps_queue WHERE sessionId=?', sessionId)).map((row) => JSON.parse(row.payload));
const matches = (a, b) => a?.sessionId === b?.sessionId && Boolean(a?.ownerKey) && a?.ownerKey === b?.ownerKey;

export const trackingStore = {
  read: async () => read(await db()),
  set: async (state) => (await db()).withExclusiveTransactionAsync(async (tx) => {
    if (!matches(await read(tx), state)) await tx.runAsync('DELETE FROM gps_queue');
    await tx.runAsync('INSERT OR REPLACE INTO tracking_state(id,payload) VALUES(1,?)', JSON.stringify(state));
  }),
  clear: async (scope) => (await db()).withExclusiveTransactionAsync(async (tx) => {
    if (scope?.ownerKey && !matches(await read(tx), scope)) return;
    await tx.runAsync('DELETE FROM tracking_state'); await tx.runAsync('DELETE FROM gps_queue');
  }),
  append: async (scope, points) => (await db()).withExclusiveTransactionAsync(async (tx) => {
    if (!matches(await read(tx), scope)) return;
    const queue = trimQueue([...(await rows(tx, scope.sessionId)), ...points]);
    await tx.runAsync('DELETE FROM gps_queue');
    for (const point of queue) await tx.runAsync('INSERT OR IGNORE INTO gps_queue(sampleId,sessionId,payload) VALUES(?,?,?)', point.sampleId, scope.sessionId, JSON.stringify(point));
  }),
  peek: async (scope) => trimQueue(await rows(await db(), scope.sessionId)),
  ack: async (scope, receipt) => (await db()).withExclusiveTransactionAsync(async (tx) => {
    if (!matches(await read(tx), scope)) return;
    const queue = acknowledge(trimQueue(await rows(tx, scope.sessionId)), receipt);
    await tx.runAsync('DELETE FROM gps_queue');
    for (const point of queue) await tx.runAsync('INSERT INTO gps_queue(sampleId,sessionId,payload) VALUES(?,?,?)', point.sampleId, scope.sessionId, JSON.stringify(point));
  }),
};
