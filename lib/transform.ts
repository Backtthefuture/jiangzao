// 数据转换工具

import { Content } from './types';
import { getRecords, getRecordById, getImageTempUrls } from './feishu';
import { cache, CACHE_KEYS, CACHE_TTL } from './cache';

/**
 * 转换飞书记录为前端数据格式
 */
export function transformFeishuRecord(record: any): Content {
  const fields = record.fields;

  // 日志记录，帮助调试
  console.log(`   Transforming record: ${record.record_id}`);
  console.log(`     Title: ${fields['标题']}`);
  console.log(`     Status: ${fields['状态']}`);
  console.log(`     Tags: ${fields['标签']?.length || 0}`);
  console.log(`     PublishedAt: ${fields['发布时间']}`);

  // 状态映射：飞书中文 -> 英文
  const statusMap: Record<string, 'draft' | 'published'> = {
    '已发布': 'published',
    '草稿': 'draft',
  };
  const feishuStatus = fields['状态'] || '草稿';
  const mappedStatus = statusMap[feishuStatus] || 'draft';

  // 统一来源平台映射
  const rawSource: string = String(fields['来源平台'] || '').trim().toLowerCase();
  const normalizedSource: Content['source'] = (() => {
    if (['bilibili', 'b站', 'bili', '哔哩', '哔哩哔哩'].includes(rawSource)) {
      return 'bilibili';
    }
    if (['youtube', 'yt', '油管', 'y2b'].includes(rawSource)) {
      return 'youtube';
    }
    if (['xiaoyuzhou', '小宇宙', 'xyz'].includes(rawSource)) {
      return 'xiaoyuzhou';
    }
    // 默认回退到小宇宙，避免未知值破坏前端逻辑
    return 'xiaoyuzhou';
  })();

  // 兼容飞书“超链接”或“文本”两种字段结构
  const rawLink = fields['原内容链接'];
  const originalLink: string =
    typeof rawLink === 'string' ? rawLink : rawLink?.link || '';

  return {
    id: record.record_id,
    title: fields['标题'] || '',
    guest: fields['嘉宾'] || '',
    source: normalizedSource,
    coverImage: {
      file_token: fields['封面图']?.[0]?.file_token || '',
      url: '', // 将在批量获取临时URL后填充
    },
    tags: Array.isArray(fields['标签']) && fields['标签'].length > 0
      ? fields['标签']
      : ['未分类'], // 如果没有标签，使用默认标签
    quotes: [
      fields['金句1'],
      fields['金句2'],
      fields['金句3'],
      fields['金句4'],
      fields['金句5'],
    ].filter(Boolean), // 过滤空值
    content: fields['摘要正文'] || '',
    originalLink,
    status: mappedStatus,
    publishedAt: fields['发布时间'] ? new Date(fields['发布时间']) : new Date(), // 如果没有发布时间，使用当前时间
  };
}

/**
 * 根据来源平台获取合适的占位图
 * @param source 内容来源平台
 * @returns 占位图路径
 */
function getFallbackImage(source: Content['source']): string {
  switch (source) {
    case 'xiaoyuzhou':
      return '/podcast-placeholder.svg';  // 小宇宙: 正方形播客占位图
    case 'bilibili':
    case 'youtube':
      return '/video-placeholder.svg';    // 视频平台: 16:9视频占位图
    default:
      return '/video-placeholder.svg';    // 默认使用视频占位图
  }
}

/**
 * 图片URL获取（带L3缓存）
 */
async function getImageTempUrlsWithCache(
  fileTokens: string[]
): Promise<Record<string, string>> {
  if (fileTokens.length === 0) {
    return {};
  }

  const urlMap: Record<string, string> = {};
  const tokensToFetch: string[] = [];

  // 1. 先从L3缓存获取
  for (const token of fileTokens) {
    const cached = cache.get<string>(CACHE_KEYS.IMAGE_URL(token));
    if (cached) {
      urlMap[token] = cached;
    } else {
      tokensToFetch.push(token);
    }
  }

  console.log(
    `   🖼️  Image URLs: ${fileTokens.length - tokensToFetch.length} from cache, ${tokensToFetch.length} to fetch`
  );

  // 2. 批量获取未缓存的URL
  if (tokensToFetch.length > 0) {
    const freshUrls = await getImageTempUrls(tokensToFetch);

    // 3. 存入L3缓存
    Object.entries(freshUrls).forEach(([token, url]) => {
      cache.set(CACHE_KEYS.IMAGE_URL(token), url, CACHE_TTL.IMAGE_URL);
      urlMap[token] = url;
    });
  }

  return urlMap;
}

/**
 * 完整的内容获取流程(包含图片URL + L1缓存)
 */
export async function getContentsWithImages(options?: {
  pageSize?: number;
  pageToken?: string;
  filter?: string;
}): Promise<{
  contents: Content[];
  hasMore: boolean;
  pageToken?: string;
}> {
  // 检查L1缓存（仅当获取全部且无特殊参数时）
  if (!options?.pageToken && !options?.filter && !options?.pageSize) {
    const cached = cache.get<Content[]>(CACHE_KEYS.RECORDS_ALL);
    if (cached) {
      console.log('✅ L1 Cache hit: all records');
      return { contents: cached, hasMore: false };
    }
    console.log('❌ L1 Cache miss: all records');
  }

  // 1. 从飞书获取记录列表
  const { items, hasMore, pageToken } = await getRecords(options);

  // 2. 转换为前端数据格式
  const contents = items.map(transformFeishuRecord);

  // 3. 提取所有file_token
  const fileTokens = contents
    .map((c) => c.coverImage.file_token)
    .filter(Boolean);

  // 4. 批量获取临时URL (使用L3缓存)
  const urlMap = await getImageTempUrlsWithCache(fileTokens);

  // 5. 填充图片URL
  contents.forEach((content) => {
    if (content.coverImage.file_token) {
      // 优先使用飞书URL，失败则根据平台类型选择占位图
      content.coverImage.url =
        urlMap[content.coverImage.file_token] ||
        getFallbackImage(content.source);
    } else {
      // 如果没有file_token，也提供fallback
      content.coverImage.url = getFallbackImage(content.source);
    }
  });

  // 存入L1缓存（仅当获取全部时）
  if (!options?.pageToken && !options?.filter && !options?.pageSize) {
    cache.set(CACHE_KEYS.RECORDS_ALL, contents, CACHE_TTL.RECORDS);
  }

  return { contents, hasMore, pageToken };
}

/**
 * 获取单条内容（包含图片URL + L2缓存）
 * 🔥 核心优化：直接获取单条，不再获取全部
 */
export async function getContentWithImage(
  recordId: string
): Promise<Content | null> {
  // 1. 检查L2缓存
  const cached = cache.get<Content>(CACHE_KEYS.RECORD(recordId));
  if (cached) {
    console.log('✅ L2 Cache hit:', recordId);
    return cached;
  }

  console.log('❌ L2 Cache miss:', recordId);

  try {
    // 2. 直接获取单条记录（不再获取全部）
    const record = await getRecordById(recordId);
    const content = transformFeishuRecord(record);

    // 3. 获取单张图片URL（优先从L3缓存）
    if (content.coverImage.file_token) {
      const urlMap = await getImageTempUrlsWithCache([
        content.coverImage.file_token,
      ]);
      content.coverImage.url =
        urlMap[content.coverImage.file_token] ||
        getFallbackImage(content.source);
    } else {
      // 如果没有file_token，也提供fallback
      content.coverImage.url = getFallbackImage(content.source);
    }

    // 4. 存入L2缓存
    cache.set(CACHE_KEYS.RECORD(recordId), content, CACHE_TTL.RECORDS);

    return content;
  } catch (error) {
    console.error('Failed to get content:', error);
    return null;
  }
}

/**
 * 聚合标签信息（使用缓存）
 */
export async function aggregateTags(): Promise<
  Array<{ name: string; count: number }>
> {
  // 检查聚合缓存
  const cached = cache.get<Array<{ name: string; count: number }>>(
    CACHE_KEYS.TAGS
  );
  if (cached) {
    console.log('✅ Cache hit: aggregate tags');
    return cached;
  }

  const { contents } = await getContentsWithImages();

  // 只统计已发布的内容
  const published = contents.filter((c) => c.status === 'published');

  const tagCounts = new Map<string, number>();

  published.forEach((content) => {
    content.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  const result = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 存入缓存
  cache.set(CACHE_KEYS.TAGS, result, CACHE_TTL.RECORDS);

  return result;
}

/**
 * 聚合嘉宾信息（使用缓存）
 */
export async function aggregateGuests(): Promise<
  Array<{ name: string; count: number }>
> {
  // 检查聚合缓存
  const cached = cache.get<Array<{ name: string; count: number }>>(
    CACHE_KEYS.GUESTS
  );
  if (cached) {
    console.log('✅ Cache hit: aggregate guests');
    return cached;
  }

  const { contents } = await getContentsWithImages();

  // 只统计已发布的内容
  const published = contents.filter((c) => c.status === 'published');

  const guestCounts = new Map<string, number>();

  published.forEach((content) => {
    const guest = content.guest;
    guestCounts.set(guest, (guestCounts.get(guest) || 0) + 1);
  });

  const result = Array.from(guestCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 存入缓存
  cache.set(CACHE_KEYS.GUESTS, result, CACHE_TTL.RECORDS);

  return result;
}

/**
 * 按标签筛选内容（使用缓存）
 */
export async function getContentsByTag(tag: string): Promise<Content[]> {
  const { contents } = await getContentsWithImages();

  return contents.filter(
    (c) => c.status === 'published' && c.tags.includes(tag)
  );
}

/**
 * 按嘉宾筛选内容（使用缓存）
 */
export async function getContentsByGuest(guest: string): Promise<Content[]> {
  const { contents } = await getContentsWithImages();

  return contents.filter(
    (c) => c.status === 'published' && c.guest === guest
  );
}
