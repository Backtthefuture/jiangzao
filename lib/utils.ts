/**
 * 通用工具函数
 */

import { Content, DateGroup, VideoEmbedMeta } from './types';

/**
 * 格式化日期为中文友好格式
 * @param date Date对象或ISO字符串
 * @returns 格式化后的日期字符串，例如: "2025年10月8日"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  // 检查是否为有效日期
  if (isNaN(d.getTime())) {
    return '日期未知';
  }

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  return `${year}年${month}月${day}日`;
}

/**
 * 格式化日期为简短格式
 * @param date Date对象或ISO字符串
 * @returns 格式化后的日期字符串，例如: "2025-10-08"
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '未知';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间为 HH:MM
 * @param date Date对象或ISO字符串
 * @returns 格式化后的时间字符串，例如: "15:30"
 */
export function formatTime(date: Date | string | undefined): string {
  if (!date) {
    return '--:--';
  }

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '--:--';
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

/**
 * 获取相对日期显示
 * @param date Date对象或ISO字符串
 * @returns "今天"、"昨天"、"2天前"、"10月29日"
 */
export function getRelativeDate(date: Date | string | undefined): string {
  if (!date) {
    return '未知日期';
  }

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '未知日期';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // 重置到当天0点
  const targetDate = new Date(d);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays >= 2 && diffDays <= 7) return `${diffDays}天前`;

  // 超过7天时，判断是否需要显示年份
  const currentYear = today.getFullYear();
  const targetYear = d.getFullYear();

  if (targetYear < currentYear) {
    // 今年以前: 显示完整日期(带年份)
    return `${targetYear}年${d.getMonth() + 1}月${d.getDate()}日`;
  } else {
    // 今年: 只显示月日
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
}

/**
 * 按日期分组内容
 * @param contents 内容数组（已按时间倒序排列）
 * @returns 日期分组数组
 */
export function groupContentsByDate(contents: Content[]): DateGroup[] {
  const groupsMap = new Map<string, Content[]>();

  contents.forEach((content) => {
    // 处理publishedAt可能为undefined的情况
    if (!content.publishedAt) {
      const dateLabel = '未知日期';
      if (!groupsMap.has(dateLabel)) {
        groupsMap.set(dateLabel, []);
      }
      groupsMap.get(dateLabel)!.push(content);
      return;
    }

    const date = new Date(content.publishedAt);
    const relativeDate = getRelativeDate(date);

    // 判断是否为相对时间（需要加括号）还是具体日期（不需要括号）
    const isRelativeTime =
      relativeDate.includes('今天') ||
      relativeDate.includes('昨天') ||
      relativeDate.includes('天前');

    let dateLabel: string;
    if (isRelativeTime) {
      // 相对时间: 加括号显示具体日期, e.g., "今天 (10月31日)"
      const month = date.getMonth() + 1;
      const day = date.getDate();
      dateLabel = `${relativeDate} (${month}月${day}日)`;
    } else {
      // 具体日期: 直接使用, 无需括号, e.g., "10月21日" 或 "2024年10月10日"
      dateLabel = relativeDate;
    }

    if (!groupsMap.has(dateLabel)) {
      groupsMap.set(dateLabel, []);
    }
    groupsMap.get(dateLabel)!.push(content);
  });

  // 转换为数组并保持原有排序（因为contents已经是时间倒序）
  return Array.from(groupsMap.entries()).map(([dateLabel, contents]) => ({
    dateLabel,
    contents,
  }));
}

/**
 * 根据原始链接推导视频内嵌信息，仅支持 YouTube 与 Bilibili.
 * @param originalLink 原始外链
 * @param source 内容来源标识
 */
export function deriveVideoEmbedMeta(
  originalLink: string | undefined,
  source: Content['source'],
): VideoEmbedMeta | null {
  if (!originalLink) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(originalLink);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();

  if (source === 'youtube') {
    const videoId = extractYouTubeId(parsed, hostname);
    if (!videoId) {
      return null;
    }
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
    };
  }

  if (source === 'bilibili') {
    const biliMeta = extractBilibiliMeta(parsed, hostname);
    if (!biliMeta) {
      return null;
    }

    const params = new URLSearchParams({
      autoplay: '0',
      high_quality: '1',
      as_wide: '1',
      page: String(biliMeta.page),
    });

    params.set(biliMeta.paramKey, biliMeta.paramValue);

    return {
      provider: 'bilibili',
      embedUrl: `https://player.bilibili.com/player.html?${params.toString()}`,
    };
  }

  return null;
}

/**
 * 根据原始链接推导视频封面缩略图，仅支持部分平台。
 */
export function deriveVideoThumbnail(
  originalLink: string | undefined,
  source: Content['source'],
): string | null {
  if (!originalLink) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(originalLink);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();

  if (source === 'youtube') {
    const videoId = extractYouTubeId(parsed, hostname);
    if (!videoId) {
      return null;
    }
    // 使用高质量缩略图（若不存在由平台自动降级）
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  if (source === 'bilibili') {
    // B站缩略图需调用开放接口才能稳定获取，这里回退统一占位图。
    return null;
  }

  return null;
}

function extractYouTubeId(parsed: URL, hostname: string): string | null {
  if (!['youtube.com', 'youtu.be', 'm.youtube.com'].includes(hostname)) {
    return null;
  }

  if (hostname === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return validateYouTubeId(id);
  }

  if (parsed.pathname.startsWith('/watch')) {
    const id = parsed.searchParams.get('v');
    return validateYouTubeId(id ?? undefined);
  }

  if (parsed.pathname.startsWith('/shorts/')) {
    const id = parsed.pathname.split('/')[2];
    return validateYouTubeId(id);
  }

  if (parsed.pathname.startsWith('/embed/')) {
    const id = parsed.pathname.split('/')[2];
    return validateYouTubeId(id);
  }

  return null;
}

function validateYouTubeId(id?: string): string | null {
  if (!id) {
    return null;
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

function extractBilibiliMeta(
  parsed: URL,
  hostname: string,
): { paramKey: 'bvid' | 'aid'; paramValue: string; page: number } | null {
  if (!hostname.endsWith('bilibili.com')) {
    return null;
  }

  const pathname = parsed.pathname;
  const searchParams = parsed.searchParams;
  const page = Number.parseInt(searchParams.get('p') ?? '1', 10);
  const safePage = Number.isNaN(page) || page <= 0 ? 1 : page;

  const bvMatch = pathname.match(/\/video\/(BV[0-9A-Za-z]+)/);
  if (bvMatch) {
    return {
      paramKey: 'bvid',
      paramValue: bvMatch[1],
      page: safePage,
    };
  }

  const avMatch = pathname.match(/\/video\/av(\d+)/i);
  if (avMatch) {
    return {
      paramKey: 'aid',
      paramValue: avMatch[1],
      page: safePage,
    };
  }

  return null;
}

/**
 * 统计 Markdown 文本的纯文本字符数（去除 Markdown 标记）
 * @param markdown Markdown 格式文本
 * @returns 字符数
 */
export function countMarkdownCharacters(markdown: string): number {
  if (!markdown) {
    return 0;
  }

  let text = markdown;

  // 去除代码块
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, '');

  // 去除图片
  text = text.replace(/!\[.*?\]\(.*?\)/g, '');

  // 去除链接，保留文本部分
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 去除标题标记
  text = text.replace(/^#+\s+/gm, '');

  // 去除加粗和斜体
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // 去除删除线
  text = text.replace(/~~(.*?)~~/g, '$1');

  // 去除列表标记
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // 去除引用标记
  text = text.replace(/^>\s+/gm, '');

  // 去除水平线
  text = text.replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '');

  // 去除HTML标签
  text = text.replace(/<[^>]+>/g, '');

  // 去除多余空白
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text.length;
}

/**
 * 根据字符数计算阅读时间
 * @param characterCount 字符数
 * @returns 阅读时间（分钟），最少为 1 分钟
 */
export function calculateReadingTime(characterCount: number): number {
  if (characterCount <= 0) {
    return 1;
  }

  const wordsPerMinute = 450; // 中文阅读速度：约 450 字/分钟
  const minutes = Math.ceil(characterCount / wordsPerMinute);

  return Math.max(1, minutes);
}

/**
 * 格式化字符数显示
 * @param count 字符数
 * @returns 格式化后的字符串（例：856、2.3K、1.2万）
 */
export function formatCharCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  }

  if (count < 10000) {
    const kValue = count / 1000;
    return kValue.toFixed(1).replace(/\.0$/, '') + 'K';
  }

  const wanValue = count / 10000;
  return wanValue.toFixed(1).replace(/\.0$/, '') + '万';
}
