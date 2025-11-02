# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"降噪" (Noise Reduction) is an AI industry interview curation platform built with Next.js 14 App Router. The platform aggregates high-quality interview content from podcasts (小宇宙) and video platforms (Bilibili, YouTube), enriching them with AI-generated summaries and curated quotes. Content is sourced from Feishu (Lark) multidimensional tables, with analytics stored in SQLite.

## Development Commands

```bash
# Development server (localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting (run before commits)
npm run lint
```

## Testing Commands

```bash
# Test Feishu API connectivity
node scripts/test-feishu.js

# Manual testing after changes
# 1. Run 'npm run lint'
# 2. Start dev server and verify the homepage loads
# 3. Test Feishu script with populated .env.local
```

## Architecture & Data Flow

### Three-Tier Caching System

The codebase implements a sophisticated three-level in-memory caching strategy (`lib/cache.ts`):

- **L1 Cache**: All published records (`RECORDS_ALL`, 5min TTL)
- **L2 Cache**: Individual record by ID (`RECORD:{id}`, 5min TTL)
- **L3 Cache**: Feishu image temporary URLs (`IMAGE_URL:{token}`, 23hr TTL)

**Critical**: Feishu image URLs expire after 24 hours. The L3 cache stores them for 23 hours with a 1-hour buffer, and Next.js ISR (`revalidate=21600`, 6hrs) ensures pages refresh URLs before expiration.

### Data Transformation Pipeline

Content flows through `lib/transform.ts`:

1. **Fetch**: `getRecords()` retrieves raw Feishu multidimensional table records
2. **Transform**: `transformFeishuRecord()` maps Chinese field names to English types
3. **Enrich**: `getImageTempUrlsWithCache()` batch-fetches Feishu image temporary URLs
4. **Aggregate**: Functions like `aggregateTags()` and `aggregateGuests()` build filter lists

The transform layer handles:
- Status mapping: `已发布` → `published`, `草稿` → `draft`
- Source normalization: `小宇宙`/`B站`/`YouTube` → `xiaoyuzhou`/`bilibili`/`youtube`
- Default fallbacks: Missing tags become `['未分类']`, invalid sources default to `xiaoyuzhou`
- Link field compatibility: Handles both Feishu hyperlink objects and plain strings

### Feishu API Integration

`lib/feishu.ts` provides retry-aware clients:

- **Token caching**: Access tokens cached for ~2hrs (expires - 5min buffer)
- **Retry logic**: All API calls retry up to 3 times with exponential backoff (1s, 2s)
- **Batch operations**: `getImageTempUrls()` fetches multiple image URLs in a single request
- **Advanced permissions**: `getImageTempUrlWithExtra()` handles Bases with strict access controls

### SQLite Analytics Store

`lib/db.ts` manages view/click tracking in `data/analytics.db`:

- WAL mode enabled for concurrent read/write
- Upsert pattern for atomic counter increments
- Batch queries optimize homepage card rendering

## App Router Structure

```
app/
├── page.tsx                    # Homepage timeline (ISR cached)
├── content/[id]/page.tsx       # Detail view with markdown rendering
├── tags/[name]/page.tsx        # Tag-filtered timeline
├── guests/[name]/page.tsx      # Guest-filtered timeline
└── api/
    ├── contents/route.ts       # List contents (supports ?tag=, ?guest= filters)
    ├── contents/[id]/route.ts  # Single content detail
    ├── tags/route.ts           # Aggregated tag list
    ├── guests/route.ts         # Aggregated guest list
    ├── analytics/view/route.ts # Increment view counter
    ├── analytics/click/route.ts# Increment click counter
    ├── cache/route.ts          # Manual cache stats/clear endpoint
    └── revalidate/route.ts     # ISR on-demand revalidation
```

## Key Components

### Timeline Display

- `TimelineView.tsx`: Groups contents by relative date ("今天", "昨天", "3天前")
- `TimelineGroup.tsx`: Renders a single date group with separator
- `TimelineCard.tsx`: Individual content card with cover image, tags, quotes, and analytics

### Content Detail

- `ContentCard.tsx`: Full content view with markdown rendering
- `QuoteBlock.tsx`: Styled quote display
- `TableOfContents.tsx`: Auto-generated TOC from markdown headings

### Utilities

`lib/utils.ts` provides:

- **Date formatting**: `formatDate()`, `getRelativeDate()`, `groupContentsByDate()`
- **Video embedding**: `deriveVideoEmbedMeta()` extracts YouTube/Bilibili embed URLs from original links
- **Reading time**: `countMarkdownCharacters()` + `calculateReadingTime()` for estimated reading duration

## Environment Variables

Required in `.env.local`:

```bash
# Feishu credentials (see 飞书配置指南.md for setup)
FEISHU_APP_ID=cli_xxxxx
FEISHU_APP_SECRET=xxxxx

# Feishu multidimensional table IDs (extract from Base URL)
FEISHU_BASE_ID=bascnXXXXX
FEISHU_TABLE_ID=tblXXXXX

# Site configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ISR revalidation interval (default: 21600 = 6 hours)
ISR_REVALIDATE=21600
```

**Never commit** `.env.local` or expose credentials. Refer to `飞书配置指南.md` for complete Feishu app setup steps including required permissions (`bitable:app:readonly`).

## Feishu Multidimensional Table Schema

The Feishu table must include these fields (Chinese names as defined in transform logic):

| Field Name | Type | Required | Notes |
|-----------|------|----------|-------|
| 标题 | Single-line text | ✅ | Interview title |
| 嘉宾 | Single-line text | ✅ | Guest name |
| 来源平台 | Single-select | ✅ | Options: `小宇宙`, `B站`, `YouTube` |
| 封面图 | Attachment | ✅ | Cover image (first file token used) |
| 标签 | Multi-select | ✅ | Tags (defaults to `['未分类']` if empty) |
| 金句1-5 | Multi-line text | First 3 required | Key quotes (金句4, 金句5 optional) |
| 摘要正文 | Multi-line text | ✅ | Markdown content body (~2000 chars) |
| 原内容链接 | Hyperlink | ✅ | Original source URL |
| 状态 | Single-select | ✅ | Options: `草稿`, `已发布` (only `已发布` shown on site) |
| 发布时间 | Date | ✅ | Publish date |

## Code Conventions

- **Imports**: Use `@/` alias for internal modules (configured in `tsconfig.json`)
- **Formatting**: 2-space indentation, explicit semicolons, single quotes for strings
- **Async patterns**: Prefer `async/await` over promise chains
- **Component naming**: PascalCase files (e.g., `TimelineView.tsx`), camelCase for utilities
- **Server/client separation**: API routes in `app/api/*/route.ts`, client components marked with `'use client'`

## Common Pitfalls

1. **Feishu image URLs**: Always use temporary URLs from `batch_get_tmp_download_url`, not raw file tokens. URLs expire after 24 hours.

2. **ISR timing**: `revalidate` must be < 24hrs to prevent image URL expiration. Default 6hrs (21600s) provides safety margin.

3. **Status filtering**: Only content with `status: 'published'` appears in public views. Check transform mapping if records don't show.

4. **Field name matching**: Feishu field names are in Chinese. The `transformFeishuRecord()` function maps them to English properties. Any schema changes require updating this mapping.

5. **Cache invalidation**: When testing content changes, clear L1/L2 cache via `/api/cache` endpoint or restart dev server.

6. **SQLite concurrency**: The analytics database uses WAL mode. On deployment platforms, ensure persistent storage for `data/analytics.db` or analytics will reset.

## Deployment Considerations

- **Vercel/Railway**: Configure environment variables in platform dashboard
- **Persistent storage**: Mount `data/analytics.db` to persistent volume to retain analytics across deploys
- **ISR caching**: Next.js ISR works out-of-the-box on Vercel; other platforms may need cache adapter
- **Build output**: Ensure `data/` directory exists at runtime (auto-created by SQLite on first write)

## Reference Documentation

- Feishu setup: `飞书配置指南.md` (complete walkthrough with screenshots)
- Content workflow: `AGENTS.md` (AI agent configuration for content processing)
- Product requirements: `prd.md` (detailed feature specs and milestones)
- Authorization troubleshooting: `权限问题完整排查清单.md`
- Data sync guide: `数据更新说明.md`
