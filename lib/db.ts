// SQLite数据库操作

import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

/**
 * 获取数据库实例
 */
function getDB(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'analytics.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); // 启用WAL模式，支持并发
    initDB();
  }
  return db;
}

/**
 * 初始化数据库表
 */
export function initDB(): void {
  const db = getDB();

  // 创建analytics表
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics (
      record_id TEXT PRIMARY KEY,
      view_count INTEGER DEFAULT 0,
      click_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_view_count ON analytics(view_count DESC);
    CREATE INDEX IF NOT EXISTS idx_click_count ON analytics(click_count DESC);
  `);
}

/**
 * 记录浏览量
 */
export function trackView(recordId: string): number {
  const db = getDB();

  const stmt = db.prepare(`
    INSERT INTO analytics (record_id, view_count, click_count)
    VALUES (?, 1, 0)
    ON CONFLICT(record_id) DO UPDATE SET
      view_count = view_count + 1,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(recordId);

  // 返回最新的view_count
  const row = db
    .prepare('SELECT view_count FROM analytics WHERE record_id = ?')
    .get(recordId) as { view_count: number } | undefined;

  return row?.view_count || 1;
}

/**
 * 记录点击量
 */
export function trackClick(recordId: string): number {
  const db = getDB();

  const stmt = db.prepare(`
    INSERT INTO analytics (record_id, view_count, click_count)
    VALUES (?, 0, 1)
    ON CONFLICT(record_id) DO UPDATE SET
      click_count = click_count + 1,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(recordId);

  // 返回最新的click_count
  const row = db
    .prepare('SELECT click_count FROM analytics WHERE record_id = ?')
    .get(recordId) as { click_count: number } | undefined;

  return row?.click_count || 1;
}

/**
 * 获取单条记录的统计数据
 */
export function getAnalytics(recordId: string): {
  viewCount: number;
  clickCount: number;
} | null {
  const db = getDB();

  const row = db
    .prepare('SELECT view_count, click_count FROM analytics WHERE record_id = ?')
    .get(recordId) as
    | { view_count: number; click_count: number }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    viewCount: row.view_count,
    clickCount: row.click_count,
  };
}

/**
 * 批量获取统计数据
 */
export function getBatchAnalytics(
  recordIds: string[]
): Map<string, { viewCount: number; clickCount: number }> {
  if (recordIds.length === 0) {
    return new Map();
  }

  const db = getDB();

  const placeholders = recordIds.map(() => '?').join(',');
  const stmt = db.prepare(
    `SELECT record_id, view_count, click_count FROM analytics WHERE record_id IN (${placeholders})`
  );

  const rows = stmt.all(...recordIds) as Array<{
    record_id: string;
    view_count: number;
    click_count: number;
  }>;

  const result = new Map<string, { viewCount: number; clickCount: number }>();

  rows.forEach((row) => {
    result.set(row.record_id, {
      viewCount: row.view_count,
      clickCount: row.click_count,
    });
  });

  return result;
}

/**
 * 获取总体统计数据
 */
export function getSummaryAnalytics(): {
  totalViews: number;
  totalClicks: number;
  totalRecords: number;
} {
  const db = getDB();

  const row = db
    .prepare(
      'SELECT SUM(view_count) as total_views, SUM(click_count) as total_clicks, COUNT(*) as total_records FROM analytics'
    )
    .get() as {
    total_views: number | null;
    total_clicks: number | null;
    total_records: number;
  };

  return {
    totalViews: row.total_views || 0,
    totalClicks: row.total_clicks || 0,
    totalRecords: row.total_records || 0,
  };
}
