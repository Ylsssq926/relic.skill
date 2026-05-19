import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { ConfigurationError } from '../utils/errors';
import { logger } from '../utils/logger';

const DEFAULT_DATABASE_PATH = path.resolve(__dirname, '../../data/relics/demo-api.sqlite3');
const DEFAULT_SCHEMA_PATH = path.resolve(__dirname, 'schema.sql');

/**
 * SQLite 连接管理器。
 */
class DatabaseProvider {
  private connection?: Database.Database;

  public initialize(databasePath = process.env.DEMO_API_DB_PATH?.trim() || DEFAULT_DATABASE_PATH): Database.Database {
    if (this.connection) {
      return this.connection;
    }

    fs.mkdirSync(path.dirname(databasePath), { recursive: true });

    const connection = new Database(databasePath);
    connection.pragma('journal_mode = WAL');
    connection.pragma('foreign_keys = ON');
    connection.pragma('busy_timeout = 5000');
    connection.pragma('synchronous = NORMAL');

    const schema = fs.readFileSync(DEFAULT_SCHEMA_PATH, 'utf8');
    connection.exec(schema);

    this.connection = connection;

    logger.info('数据库初始化完成', {
      databasePath,
    });

    return connection;
  }

  public getConnection(): Database.Database {
    if (!this.connection) {
      throw new ConfigurationError('数据库尚未初始化');
    }

    return this.connection;
  }

  public transaction<T>(handler: (database: Database.Database) => T): T {
    const connection = this.getConnection();
    const transaction = connection.transaction(() => handler(connection));
    return transaction();
  }

  public close(): void {
    if (!this.connection) {
      return;
    }

    this.connection.close();
    this.connection = undefined;
    logger.info('数据库连接已关闭');
  }
}

export const databaseProvider = new DatabaseProvider();

export function initializeDatabase(): Database.Database {
  return databaseProvider.initialize();
}

export function getDatabase(): Database.Database {
  return databaseProvider.getConnection();
}

export function withTransaction<T>(handler: (database: Database.Database) => T): T {
  return databaseProvider.transaction(handler);
}
