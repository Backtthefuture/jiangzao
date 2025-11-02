// 三级内存缓存模块

/**
 * 缓存条目接口
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * 缓存统计接口
 */
export interface CacheStats {
  size: number;         // 当前缓存项数量
  hits: number;         // 命中次数
  misses: number;       // 未命中次数
  hitRate: string;      // 命中率 (eg. "85.3%")
}

/**
 * 内存缓存类
 */
class MemoryCache {
  private cache: Map<string, CacheEntry<any>>;
  private hits: number;
  private misses: number;

  constructor() {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 获取缓存
   * 自动检查过期并清理
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // 检查是否过期
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      console.log(`⏰ Cache expired: ${key}`);
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttlMs 过期时间（毫秒）
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
    console.log(`💾 Cache set: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️  Cache deleted: ${key}`);
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    console.log(`🧹 Cache cleared: ${size} items removed`);
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%';

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}

// 导出单例
export const cache = new MemoryCache();

// 缓存键常量
export const CACHE_KEYS = {
  RECORDS_ALL: 'feishu:records:all',
  RECORD: (id: string) => `feishu:record:${id}`,
  IMAGE_URL: (token: string) => `image:url:${token}`,
  TAGS: 'aggregate:tags',
  GUESTS: 'aggregate:guests',
};

// TTL常量（毫秒）
export const CACHE_TTL = {
  RECORDS: 5 * 60 * 1000,          // 5分钟
  IMAGE_URL: 23 * 60 * 60 * 1000,  // 23小时（飞书URL 24小时有效，预留1小时缓冲）
};
