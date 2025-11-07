# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"降噪" (Noise Reduction) is an AI industry interview curation platform built with Next.js 14 App Router. The platform aggregates high-quality interview content from podcasts (小宇宙) and video platforms (Bilibili, YouTube), enriching them with AI-generated summaries and curated quotes. Content is sourced from Feishu (Lark) multidimensional tables, with analytics stored in SQLite and user authentication managed by Supabase.

**Current Version**: 1.4.6 (includes authentication, payment, AI bargaining, Vercel deployment, service_role callback fix, and homepage stats badge with correct domain)

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

### Payment System (V1.3.0+)

**Z-Pay Integration** (`lib/zpay.ts`):
- Payment order creation with signature verification
- Callback webhook handling for payment status
- Order status polling
- Signature validation for security

**Membership Management** (`lib/membership.ts`):
- Three tiers: Monthly (¥9.9/month), Yearly (¥99/year), Lifetime (¥299 one-time)
- Automatic expiry calculation based on product type
- Membership activation on successful payment
- Query current membership status

**Order Flow**:
1. User selects membership tier on `/pricing` page
2. `POST /api/payment/create-order` creates order record in Supabase
3. Z-Pay API called to generate payment URL
4. User redirected to Z-Pay payment page
5. After payment, Z-Pay sends callback to `/api/payment/callback`
6. System verifies signature, activates membership, updates order status

**V1.4.4 Callback Fix**:
- Payment callback now uses `service_role` client (from `@supabase/supabase-js`)
- Bypasses RLS to write to `orders` and `user_memberships` tables
- Previous issue: anon client was blocked by RLS policies
- Required env var: `SUPABASE_SERVICE_ROLE_KEY`

### AI Bargaining System (V1.4.0)

**Ark AI Integration** (`lib/ark.ts`):
- Calls Ark AI (火山方舟) for bargaining evaluation
- Retry logic with exponential backoff (3 attempts)
- 10-second timeout per attempt
- Fallback strategy: 20% discount if AI fails

**Bargaining Logic** (`lib/bargain.ts`):
- One-time bargaining per user (enforced by DB unique constraint)
- User inputs 30-300 character reason
- AI scores on 4 dimensions: sincerity, specificity, uniqueness, hardship (total 100 points)
- 6-tier discount mapping: 0-3% (no discount) to 90-99% (jackpot)
- Coupon generated with 24-hour expiry
- Only applies to monthly membership (¥9.9)

**Bargaining Flow**:
1. User clicks "摇一摇神秘优惠" button on monthly membership card
2. Modal opens, user enters reason for discount
3. `POST /api/bargain/submit` calls Ark AI for evaluation
4. Slot machine animation plays (~2.5s)
5. AI returns score → discount → final price
6. Coupon code generated and saved to `bargain_attempts` table
7. User can immediately pay with coupon or save for later
8. Coupon validated at payment time, marked as used after successful payment

## App Router Structure

```
app/
├── page.tsx                               # Homepage timeline (ISR cached)
├── content/[id]/page.tsx                  # Detail view with markdown rendering
├── tags/[name]/page.tsx                   # Tag-filtered timeline
├── guests/[name]/page.tsx                 # Guest-filtered timeline
├── pricing/page.tsx                       # Membership pricing page (public)
├── payment/result/page.tsx                # Payment result page
├── user/
│   ├── reading-history/page.tsx           # User reading history (auth required)
│   └── membership/page.tsx                # User membership management
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
    ├── payment/
    │   ├── create-order/route.ts          # Create Z-Pay order (supports coupon)
    │   ├── callback/route.ts              # Z-Pay payment callback webhook
    │   └── check-status/[orderId]/route.ts # Check order status
    ├── bargain/
    │   ├── status/route.ts                # Check user bargain eligibility
    │   └── submit/route.ts                # Submit bargain reason for AI evaluation
    ├── user/
    │   ├── reading-stats/route.ts         # Get user reading statistics
    │   ├── membership/route.ts            # Get user membership status
    │   └── orders/route.ts                # Get user order history (V1.4.4+)
    ├── contents/route.ts                  # List contents (supports ?tag=, ?guest= filters)
    ├── contents/[id]/route.ts             # Single content detail
    ├── tags/route.ts                      # Aggregated tag list
    ├── guests/route.ts                    # Aggregated guest list
    ├── analytics/view/route.ts            # Increment view counter (disabled on Vercel)
    ├── analytics/click/route.ts           # Increment click counter (disabled on Vercel)
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

### Payment & Bargaining

- `BargainModal.tsx`: Multi-step modal for AI bargaining (input → loading → result)
- `SlotMachineAnimation.tsx`: Animated slot machine during AI evaluation
- Payment flow integrated into pricing page with Z-Pay redirect

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
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Required for V1.4.4+ payment callback (bypasses RLS)

# Site configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ISR revalidation interval (default: 21600 = 6 hours)
ISR_REVALIDATE=21600

# Content access limits (defaults shown)
VIEW_LIMIT_FREE_MAX=3           # Monthly limit for anonymous users
VIEW_LIMIT_AUTH_MAX=10          # Monthly limit for authenticated users
VIEW_LIMIT_TIMEZONE=Asia/Shanghai  # Timezone for monthly reset calculation

# Z-Pay payment configuration (V1.3.0+)
ZPAY_API_URL=https://api.z-pay.cn
ZPAY_MERCHANT_ID=your_merchant_id
ZPAY_SECRET_KEY=your_secret_key
ZPAY_CALLBACK_URL=https://your-domain.com/api/payment/callback

# Ark AI configuration (V1.4.0+, for bargaining)
ARK_API_KEY=your_ark_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL_ID=your_model_endpoint_id

# Bargaining system configuration (V1.4.0+)
BARGAIN_ENABLED=true
BARGAIN_COUPON_EXPIRES_HOURS=24
BARGAIN_MIN_REASON_LENGTH=30
BARGAIN_MAX_REASON_LENGTH=300
BARGAIN_TEST_EMAILS=test@example.com  # Comma-separated list of emails allowed unlimited bargains

# Vercel deployment (V1.4.3+)
ENABLE_ANALYTICS=false          # Must be false on Vercel (no persistent file storage)
```

**Never commit** `.env.local` or expose credentials. Refer to:
- `飞书配置指南.md` for Feishu app setup (requires `bitable:app:readonly` permission)
- `SUPABASE_AUTH.md` for Supabase authentication setup
- `VERCEL_DEPLOYMENT.md` for Vercel deployment guide

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

The platform uses Supabase for authentication, content access tracking, membership, and payment. Required tables:

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

### `memberships` (V1.3.0+, User Membership)
- `id` (uuid, PK): Membership record ID
- `user_id` (uuid, UNIQUE): Supabase user ID
- `user_email` (text): User email
- `tier` ('monthly'|'yearly'|'lifetime'): Membership tier
- `status` ('active'|'expired'|'cancelled'): Membership status
- `started_at` (timestamptz): Membership start date
- `expires_at` (timestamptz): Expiry date (null for lifetime)
- `created_at` (timestamptz): Record creation timestamp
- `updated_at` (timestamptz): Last update timestamp

### `orders` (V1.3.0+, Payment Orders)
- `id` (uuid, PK): Order record ID
- `order_id` (text, UNIQUE): Z-Pay order ID
- `user_id` (uuid): Supabase user ID
- `user_email` (text): User email
- `product_type` ('monthly'|'yearly'|'lifetime'): Product type
- `amount` (decimal): Final payment amount
- `original_amount` (decimal): Original price before discount
- `discount_amount` (decimal): Discount amount
- `coupon_code` (text, UNIQUE INDEX): Bargain coupon code (optional)
- `status` ('pending'|'completed'|'failed'|'cancelled'): Order status
- `zpay_order_data` (jsonb): Z-Pay response data
- `created_at` (timestamptz): Order creation timestamp
- `completed_at` (timestamptz): Payment completion timestamp

### `bargain_attempts` (V1.4.0+, AI Bargaining)
- `id` (uuid, PK): Bargain record ID
- `user_id` (uuid, UNIQUE): Supabase user ID (one bargain per user)
- `user_email` (text): User email
- `reason` (text): User's bargain reason (30-300 chars)
- `reason_length` (int): Character count of reason
- `ai_score` (int): AI evaluation score (0-100)
- `ai_message` (text): AI's personalized message
- `discount_percent` (decimal): Discount percentage (0-99)
- `original_price` (decimal): Original price (9.9)
- `final_price` (decimal): Price after discount (0.01-9.90)
- `coupon_code` (text, UNIQUE): Generated coupon code
- `coupon_expires_at` (timestamptz): Coupon expiry time (24hrs)
- `coupon_used` (boolean): Whether coupon has been used
- `coupon_used_at` (timestamptz): When coupon was used
- `client_ip` (text): User IP for audit
- `user_agent` (text): User agent for audit
- `created_at` (timestamptz): Record creation timestamp

**Migration files**:
- `supabase_migration_v1.2.1.sql` and `supabase_migration_v1.2.2.sql` for content access tracking
- `supabase_migration_v1.3.0_membership.sql` and `supabase_migration_v1.3.1_orders.sql` for payment
- `supabase_migration_v1.4.0_bargain.sql` for AI bargaining

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

11. **Vercel deployment (V1.4.3)**: SQLite analytics are **disabled on Vercel** due to serverless limitations (no persistent file storage). Set `ENABLE_ANALYTICS=false` in environment variables. Analytics APIs return safe defaults (viewCount: 0, clickCount: 0) without errors.

12. **Dynamic route rendering (V1.4.3)**: All API routes using `cookies()` or `searchParams` must export `export const dynamic = 'force-dynamic'` to prevent static rendering errors during build.

13. **Bargaining limitations**: Each user can only bargain once (enforced by `UNIQUE(user_id)` constraint). Test emails in `BARGAIN_TEST_EMAILS` can bargain unlimited times for testing purposes.

14. **Payment callback security**: Z-Pay callbacks validate signatures using HMAC-MD5. Never skip signature validation in production. The callback URL must match exactly what's configured in Z-Pay merchant backend.

15. **Service Role Key (V1.4.4+)**: The bargaining API and payment callback require `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS when writing to protected tables (`bargain_attempts`, `orders`, `user_memberships`). This key has admin privileges - never expose it to client-side code. Must be configured in environment variables for both local and production environments.

16. **Payment Callback RLS (V1.4.4 Fix)**: Payment callback API must use `service_role` client, not the SSR client. The SSR client uses anon key which is blocked by RLS policies. Always use `createClient` from `@supabase/supabase-js` (not `@supabase/ssr`) for callback APIs.

17. **Payment Result Page Login (V1.4.4)**: The payment result page shows a friendly login prompt instead of forcing redirect when user is not authenticated. This prevents user confusion after completing payment.

## Deployment Considerations

### Vercel (Recommended for V1.4.4+)
- **Environment variables**: Configure all variables in Vercel dashboard (Feishu, Supabase + service_role key, Z-Pay, Ark AI, access limits)
- **Analytics**: Set `ENABLE_ANALYTICS=false` (SQLite not supported on serverless)
- **Dynamic routes**: All routes using `cookies()` or `searchParams` must export `export const dynamic = 'force-dynamic'`
- **Function timeout**: Configured to 30s in `vercel.json` for payment/AI operations
- **Region**: Set to `hkg1` (Hong Kong) for better China network performance
- **ISR caching**: Works out-of-the-box with Next.js App Router
- See `VERCEL_DEPLOYMENT.md` for complete deployment guide

### Railway / Other Platforms
- **Persistent storage**: Mount `data/analytics.db` to persistent volume to retain analytics across deploys
- **Analytics**: Can set `ENABLE_ANALYTICS=true` if persistent storage is available
- **Build output**: Ensure `data/` directory exists at runtime (auto-created by SQLite on first write)

### Supabase Configuration (All Platforms)
- **Database migrations**: Run all migration scripts in order (v1.2.1 → v1.2.2 → v1.3.0 → v1.3.1 → v1.4.0)
- **Site URL**: Set to your actual domain (e.g., `https://your-domain.vercel.app`)
- **Redirect URLs**: Add all auth callback URLs:
  - `https://your-domain.com/api/auth/callback`
  - `https://your-domain.com/auth/*`
- **Email templates**: Configure verification email with callback URL pattern
- **Service Role Key (V1.4.4+)**: Required for bargaining API and payment callback, add to environment variables (never commit). Get from: Supabase Dashboard → Settings → API → `service_role` key

### Third-Party Services
- **Z-Pay**: Configure callback URL in merchant backend to match your domain
- **Ark AI**: Ensure API key has sufficient quota for bargaining evaluations
- **Feishu**: Verify app has `bitable:app:readonly` permission

## Reference Documentation

- **Feishu setup**: `飞书配置指南.md` (complete walkthrough with screenshots)
- **Supabase authentication**: `SUPABASE_AUTH.md` (authentication system usage guide)
- **Vercel deployment**: `VERCEL_DEPLOYMENT.md` (V1.4.3 deployment guide with environment variables)
- **Version history**:
  - `RELEASE_V1.2.0.md` (authentication features)
  - `V1.4.0_IMPLEMENTATION_SUMMARY.md` (AI bargaining system)
- **Content workflow**: `AGENTS.md` (AI agent configuration for content processing)
- **Product requirements**: `prd.md` (detailed feature specs and milestones)
- **Payment documentation**: `payment.md` (Z-Pay integration details)
- **Authorization troubleshooting**: `权限问题完整排查清单.md`
- **Data sync guide**: `数据更新说明.md`
- **Database migrations**:
  - `supabase_migration_v1.2.1.sql`, `supabase_migration_v1.2.2.sql` (content access)
  - `supabase_migration_v1.3.0_membership.sql`, `supabase_migration_v1.3.1_orders.sql` (payment)
  - `supabase_migration_v1.4.0_bargain.sql` (AI bargaining)

## Feature Status (V1.4.6)

### Implemented
- ✅ User registration with email verification
- ✅ User login/logout with session management
- ✅ Anonymous user identification via cookies
- ✅ Content access control (3 views/month for free, 10 for authenticated)
- ✅ Monthly reading history page (`/user/reading-history`)
- ✅ Reading progress tracking and statistics
- ✅ User menu in header with authentication state
- ✅ Three-tier membership system (monthly/yearly/lifetime)
- ✅ Z-Pay payment integration with order management
- ✅ AI-powered bargaining system (Ark AI)
- ✅ Coupon code generation with 24-hour expiry
- ✅ Vercel deployment support with serverless optimizations
- ✅ Payment callback RLS fix using service_role client (V1.4.4)
- ✅ Order history API for membership center (V1.4.4)
- ✅ Friendly login prompt on payment result page (V1.4.4)
- ✅ Homepage bottom stats badge with Hits.sh (V1.4.5)
- ✅ Copyright footer on homepage (V1.4.5)
- ✅ Corrected stats badge domain to aihuangshu.com (V1.4.6)

### Known Limitations
- Reading history page shows only last 20 viewed contents (limit in `lib/readingHistory.ts:40`)
- Monthly reset happens at midnight on 1st day of each month (configurable timezone)
- Email verification required for all new accounts (configurable in Supabase)
- Each user can only bargain once (enforced by database constraint)
- SQLite analytics disabled on Vercel (no persistent file storage in serverless)
- Bargaining only applies to monthly membership (¥9.9)
- AI evaluation has 10-second timeout with 20% fallback discount if it fails