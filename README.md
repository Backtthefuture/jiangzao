# 降噪 - AI行业访谈精华策展平台

基于 Next.js 14 + 飞书多维表格 + SQLite 构建的内容策展平台。

## 项目简介

专注于AI行业的高质量访谈内容策展平台，通过**人工精选 + AI摘要**帮助从业者降低信息噪音，快速获取有价值的行业洞察。

## 技术栈

- **前端框架**: Next.js 14 (App Router)
- **样式方案**: Tailwind CSS + @tailwindcss/typography
- **数据源**: 飞书多维表格
- **统计数据**: SQLite (better-sqlite3)
- **Markdown渲染**: react-markdown + remark-gfm + rehype-highlight
- **类型检查**: TypeScript

## 核心功能

✅ **首页内容流** - 展示最新发布的访谈精华
✅ **内容详情页** - 标题、嘉宾、金句、Markdown正文、跳转原内容
✅ **标签筛选** - 按标签查看相关内容
✅ **嘉宾筛选** - 按嘉宾查看所有访谈
✅ **统计系统** - 浏览量/点击量统计（SQLite）
✅ **图片临时URL** - 飞书图片24小时临时链接 + ISR自动刷新

## 快速开始

### 1. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 2. 配置环境变量

确保 `.env.local` 文件包含以下配置：

\`\`\`env
# 飞书应用配置
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# 飞书多维表格配置
FEISHU_BASE_ID=your_base_id
FEISHU_TABLE_ID=your_table_id

# Next.js配置
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ISR重新验证时间(6小时)
ISR_REVALIDATE=21600
\`\`\`

### 3. 创建飞书多维表格

在飞书多维表格中创建以下字段：

| 字段名 | 字段类型 | 必填 | 说明 |
|--------|----------|------|------|
| 标题 | 单行文本 | ✅ | 访谈标题 |
| 嘉宾 | 单行文本 | ✅ | 嘉宾姓名 |
| 来源平台 | 单选 | ✅ | 小宇宙/B站/YouTube |
| 封面图 | 附件 | ✅ | 上传图片 |
| 标签 | 多选 | ✅ | 预设标签 |
| 金句1-5 | 多行文本 | 前3条必填 | 关键金句 |
| 摘要正文 | 多行文本 | ✅ | Markdown格式 |
| 原内容链接 | 超链接 | ✅ | 原访谈URL |
| 状态 | 单选 | ✅ | 草稿/已发布 |
| 发布时间 | 日期 | ✅ | 发布日期 |

### 4. 启动开发服务器

\`\`\`bash
npm run dev
\`\`\`

访问 http://localhost:3000

### 5. 构建生产版本

\`\`\`bash
npm run build
npm start
\`\`\`

## 项目结构

\`\`\`
├── app/                      # Next.js App Router
│   ├── layout.tsx           # 全局布局
│   ├── page.tsx             # 首页
│   ├── content/[id]/        # 内容详情页
│   ├── tags/                # 标签页
│   ├── guests/              # 嘉宾页
│   ├── about/               # 关于页
│   └── api/                 # API Routes
│       ├── contents/        # 内容API
│       ├── analytics/       # 统计API
│       ├── tags/           # 标签API
│       └── guests/         # 嘉宾API
├── components/              # React组件
│   ├── Header.tsx          # 顶部导航
│   ├── ContentCard.tsx     # 内容卡片
│   ├── QuoteBlock.tsx      # 金句块
│   └── TagBadge.tsx        # 标签徽章
├── lib/                     # 工具库
│   ├── feishu.ts           # 飞书API客户端
│   ├── transform.ts        # 数据转换
│   ├── db.ts               # SQLite操作
│   └── types.ts            # 类型定义
├── data/                    # 数据目录
│   └── analytics.db        # SQLite数据库（自动生成）
├── public/                  # 静态资源
└── .env.local              # 环境变量
\`\`\`

## API 接口

### GET /api/contents
查询内容列表

**参数**:
- \`tag\`: 标签筛选
- \`guest\`: 嘉宾筛选
- \`limit\`: 每页数量（默认10）
- \`offset\`: 偏移量（默认0）

### GET /api/contents/:id
获取内容详情

### GET /api/tags
获取所有标签

### GET /api/guests
获取所有嘉宾

### POST /api/analytics/view
记录浏览量

### POST /api/analytics/click
记录点击量

## 飞书图片方案

- 使用 \`batch_get_tmp_download_url\` 批量获取24小时临时链接
- ISR revalidate=21600（6小时），确保URL在24h内刷新
- 支持高级权限场景（extra参数）

## 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量（FEISHU_*）
4. 部署

### Railway 部署

1. 连接 GitHub 仓库
2. 配置环境变量
3. 部署

## 下一步计划

- [ ] 添加发布日期显示
- [ ] 优化SEO（Open Graph/Twitter Card）
- [ ] 添加RSS订阅
- [ ] 添加分享按钮
- [ ] AI评分系统
- [ ] 相关推荐功能
- [ ] 全文搜索

## 许可证

MIT

## 联系方式

- 邮箱: contact@example.com
- Twitter: @jiangzao
