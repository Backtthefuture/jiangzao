// 数据类型定义

export interface Content {
  id: string; // 飞书record_id
  title: string; // 标题
  guest: string; // 嘉宾姓名
  source: 'xiaoyuzhou' | 'bilibili' | 'youtube'; // 来源平台
  coverImage: {
    url: string; // 飞书临时下载URL
    file_token: string; // 飞书文件token
  };
  tags: string[]; // 标签数组
  quotes: string[]; // 金句数组 (3-5条)
  content: string; // Markdown正文
  originalLink: string; // 原内容链接
  status: 'draft' | 'published'; // 状态
  publishedAt: Date; // 发布时间
  // 以下字段从SQLite获取
  viewCount?: number; // 浏览量
  clickCount?: number; // 点击量
}

export interface VideoEmbedMeta {
  provider: 'youtube' | 'bilibili';
  embedUrl: string;
}

export interface Analytics {
  record_id: string;
  view_count: number;
  click_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface TagInfo {
  name: string;
  slug: string;
  contentCount: number;
}

export interface GuestInfo {
  name: string;
  slug: string;
  contentCount: number;
}

export interface DateGroup {
  dateLabel: string; // "今天 (10月31日)"
  contents: Content[];
}
