# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"降噪" (Noise Reduction) is an AI industry interview curation platform built with Next.js 14 App Router. The platform aggregates high-quality interview content from podcasts (小宇宙) and video platforms (Bilibili, YouTube), enriching them with AI-generated summaries and curated quotes. Content is sourced from Feishu (Lark) multidimensional tables, with analytics stored in SQLite and user authentication managed by Supabase.

**Current Version**: 1.2.1 (includes Supabase authentication and content access control)

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

### Supabase Authentication & Access Control

**Authentication System** (`lib/supabase/`):
- **Client-side**: `client.ts` for client components
- **Server-side**: `server.ts` for server components and API routes
- **Middleware**: `middleware.ts` for session refresh and route protection
- **Identity**: `lib/identity.ts` manages anonymous user IDs via cookies (180-day expiry)

**Content Access Control** (`lib/access.ts`):
- Monthly view limits: 3 views for anonymous users, 10 views for authenticated users
- Business month tracking: Resets on 1st of each month (configurable timezone)
- Dual tracking tables in Supabase:
  - `anon_monthly_views`: Tracks anonymous users by `anon_id` cookie
  - `content_monthly_views`: Tracks authenticated users by `user_id`
- Access logic: Previously viewed content remains accessible, new content counts against monthly quota
- Content truncation: When access denied, returns first ~500 chars of markdown

**Reading History** (`lib/readingHistory.ts`):
- Fetches user's monthly reading stats and recent views
- Enriches view records with content metadata (title, guest, source)
- Powers the `/user/reading-history` page for authenticated users

## App Router Structure

```
app/
├── page.tsx                               # Homepage timeline (ISR cached)
├── content/[id]/page.tsx                  # Detail view with markdown rendering
├── tags/[name]/page.tsx                   # Tag-filtered timeline
├── guests/[name]/page.tsx                 # Guest-filtered timeline
├── user/
│   └── reading-history/page.tsx           # User reading history (auth required)
├── auth/
│   ├── login/page.tsx                     # Login page
│   ├── signup/page.tsx                    # Registration page
│   ├── callback-success/page.tsx          # Email verification success
│   └── error/page.tsx                     # Auth error page
└── api/
    ├── auth/
    │   ├── signup/route.ts                # User registration
    │   ├── login/route.ts                 # User login
    │   ├── logout/route.ts                # User logout
    │   ├── callback/route.ts              # Email verification callback
    │   ├── resend/route.ts                # Resend verification email
    │   └── user/route.ts                  # Get current user
    ├── content/
    │   ├── access/route.ts                # Check content access (enforces monthly limits)
    │   ├── check-access/[id]/route.ts     # Check if user can access specific content
    │   └── track-view/route.ts            # Track content view
    ├── user/
    │   └── reading-stats/route.ts         # Get user reading statistics
    ├── contents/route.ts                  # List contents (supports ?tag=, ?guest= filters)
    ├── contents/[id]/route.ts             # Single content detail
    ├── tags/route.ts                      # Aggregated tag list
    ├── guests/route.ts                    # Aggregated guest list
    ├── analytics/view/route.ts            # Increment view counter
    ├── analytics/click/route.ts           # Increment click counter
    ├── cache/route.ts                     # Manual cache stats/clear endpoint
    └── revalidate/route.ts                # ISR on-demand revalidation
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

### Authentication & User

- `UserMenu.tsx`: User menu in header (shows login/signup for anonymous, email/avatar for authenticated)
- `LoginForm.tsx`: Email/password login form with validation
- `SignupForm.tsx`: Registration form with email verification flow

### Utilities

`lib/utils.ts` provides:

- **Date formatting**: `formatDate()`, `getRelativeDate()`, `groupContentsByDate()`, `formatDateShort()`, `formatTime()`
- **Video embedding**: `deriveVideoEmbedMeta()` extracts YouTube/Bilibili embed URLs from original links
- **Reading time**: `countMarkdownCharacters()` + `calculateReadingTime()` for estimated reading duration
- **Business month**: `getBusinessMonthStartISO()`, `getNextMonthResetDate()`, `calculateDaysUntilReset()` for monthly access limit tracking
- **Content truncation**: `truncateMarkdown()` for preview when access is denied

## Environment Variables

Required in `.env.local`:

```bash
# Feishu credentials (see 飞书配置指南.md for setup)
FEISHU_APP_ID=cli_xxxxx
FEISHU_APP_SECRET=xxxxx

# Feishu multidimensional table IDs (extract from Base URL)
FEISHU_BASE_ID=bascnXXXXX
FEISHU_TABLE_ID=tblXXXXX

# Supabase configuration (see SUPABASE_AUTH.md for setup)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Site configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ISR revalidation interval (default: 21600 = 6 hours)
ISR_REVALIDATE=21600

# Content access limits (defaults shown)
VIEW_LIMIT_FREE_MAX=3           # Monthly limit for anonymous users
VIEW_LIMIT_AUTH_MAX=10          # Monthly limit for authenticated users
VIEW_LIMIT_TIMEZONE=Asia/Shanghai  # Timezone for monthly reset calculation
```

**Never commit** `.env.local` or expose credentials. Refer to:
- `飞书配置指南.md` for Feishu app setup (requires `bitable:app:readonly` permission)
- `SUPABASE_AUTH.md` for Supabase authentication setup

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

## Supabase Database Schema

The platform uses Supabase for authentication and content access tracking. Required tables:

### `anon_monthly_views` (Anonymous User Tracking)
- `anon_id` (text, PK): Anonymous user ID from cookie
- `content_id` (text, PK): Content record ID
- `month_start` (text, PK): ISO date of month start (e.g., '2025-11-01')
- `first_viewed_at` (timestamptz): Initial view timestamp
- `last_viewed_at` (timestamptz): Most recent view timestamp

### `content_monthly_views` (Authenticated User Tracking)
- `user_id` (uuid, PK): Supabase user ID
- `content_id` (text, PK): Content record ID
- `month_start` (text, PK): ISO date of month start (e.g., '2025-11-01')
- `first_viewed_at` (timestamptz): Initial view timestamp
- `last_viewed_at` (timestamptz): Most recent view timestamp

**Migration files**: See `supabase_migration_v1.2.1.sql` and `supabase_migration_v1.2.2.sql` for table creation scripts.

## Common Pitfalls

1. **Feishu image URLs**: Always use temporary URLs from `batch_get_tmp_download_url`, not raw file tokens. URLs expire after 24 hours.

2. **ISR timing**: `revalidate` must be < 24hrs to prevent image URL expiration. Default 6hrs (21600s) provides safety margin.

3. **Status filtering**: Only content with `status: 'published'` appears in public views. Check transform mapping if records don't show.

4. **Field name matching**: Feishu field names are in Chinese. The `transformFeishuRecord()` function maps them to English properties. Any schema changes require updating this mapping.

5. **Cache invalidation**: When testing content changes, clear L1/L2 cache via `/api/cache` endpoint or restart dev server.

6. **SQLite concurrency**: The analytics database uses WAL mode. On deployment platforms, ensure persistent storage for `data/analytics.db` or analytics will reset.

7. **Content access logic**: Previously viewed content remains accessible even after quota exhausted. Only new content counts against monthly limits.

8. **Anonymous user tracking**: The `jz_anon_id` cookie identifies anonymous users for 180 days. Clearing cookies resets their quota.

9. **Route protection**: By default, routes except `/`, `/auth/*`, `/api/auth/*`, `/tags/*`, `/guests/*`, `/content/*` require authentication. Modify `lib/supabase/middleware.ts` to adjust protected routes.

10. **Email verification**: Supabase requires email verification for new accounts. Configure email templates in Supabase Dashboard to point callback to `/api/auth/callback?code={{.Token}}`.

## Deployment Considerations

- **Vercel/Railway**: Configure all environment variables (Feishu + Supabase + access limits) in platform dashboard
- **Persistent storage**: Mount `data/analytics.db` to persistent volume to retain analytics across deploys
- **ISR caching**: Next.js ISR works out-of-the-box on Vercel; other platforms may need cache adapter
- **Build output**: Ensure `data/` directory exists at runtime (auto-created by SQLite on first write)
- **Supabase setup**:
  - Run migration scripts to create tracking tables
  - Configure Site URL and Redirect URLs in Supabase Dashboard
  - Set up email authentication templates with correct callback URL
- **Middleware**: Next.js middleware (`middleware.ts`) handles session refresh and route protection automatically

## Reference Documentation

- **Feishu setup**: `飞书配置指南.md` (complete walkthrough with screenshots)
- **Supabase authentication**: `SUPABASE_AUTH.md` (authentication system usage guide)
- **Version history**: `RELEASE_V1.2.0.md` (v1.2.0 release notes with authentication features)
- **Content workflow**: `AGENTS.md` (AI agent configuration for content processing)
- **Product requirements**: `prd.md` (detailed feature specs and milestones)
- **Authorization troubleshooting**: `权限问题完整排查清单.md`
- **Data sync guide**: `数据更新说明.md`
- **Database migrations**: `supabase_migration_v1.2.1.sql`, `supabase_migration_v1.2.2.sql`

## Feature Status (v1.2.1)

### Implemented
- ✅ User registration with email verification
- ✅ User login/logout with session management
- ✅ Anonymous user identification via cookies
- ✅ Content access control (3 views/month for free, 10 for authenticated)
- ✅ Monthly reading history page (`/user/reading-history`)
- ✅ Reading progress tracking and statistics
- ✅ User menu in header with authentication state

### Known Limitations
- Reading history page currently shows only the last 20 viewed contents (default limit in `lib/readingHistory.ts:40`)
- Monthly reset happens at midnight on the 1st day of each month in configured timezone
- Email verification is required for all new accounts (configurable in Supabase Dashboard)