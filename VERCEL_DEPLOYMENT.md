# Vercel 部署指南

## 🚀 快速开始

### 1️⃣ 前置准备

确保你已经准备好以下账号和配置:

- ✅ Vercel 账号 (https://vercel.com)
- ✅ GitHub 账号 (已连接仓库 `Backtthefuture/jiangzao`)
- ✅ Supabase 项目 (https://supabase.com)
- ✅ Feishu 应用配置 (AppID, AppSecret, BaseID, TableID)
- ✅ Z-Pay 商户配置 (MerchantID, SecretKey)
- ✅ Ark AI API Key (火山方舟)

---

## 📝 环境变量配置

### 必需的环境变量

在 Vercel 项目设置中添加以下环境变量:

#### 1. Feishu 飞书配置
```bash
FEISHU_APP_ID=cli_xxxxx
FEISHU_APP_SECRET=xxxxx
FEISHU_BASE_ID=bascnXXXXX
FEISHU_TABLE_ID=tblXXXXX
```

#### 2. Supabase 配置
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(服务密钥)
```

#### 3. 站点配置
```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
ISR_REVALIDATE=21600
```

#### 4. 内容访问限制
```bash
VIEW_LIMIT_FREE_MAX=3
VIEW_LIMIT_AUTH_MAX=10
VIEW_LIMIT_TIMEZONE=Asia/Shanghai
VIEW_LIMIT_V122_ENABLED=true
```

#### 5. Z-Pay 支付配置
```bash
ZPAY_API_URL=https://api.z-pay.cn
ZPAY_MERCHANT_ID=your_merchant_id
ZPAY_SECRET_KEY=your_secret_key
ZPAY_CALLBACK_URL=https://your-domain.vercel.app/api/payment/callback
```

#### 6. 砍价系统配置 (V1.4.0)
```bash
BARGAIN_ENABLED=true
BARGAIN_COUPON_EXPIRES_HOURS=24
BARGAIN_MIN_REASON_LENGTH=30
BARGAIN_MAX_REASON_LENGTH=300
BARGAIN_TEST_EMAILS=your-test-email@gmail.com
```

#### 7. Ark AI 配置
```bash
ARK_API_KEY=your_ark_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL_ID=doubao-seed-1-6-flash-250828
```

#### 8. Analytics 配置 (可选)
```bash
# ⚠️ 暂时禁用 SQLite 分析功能 (Vercel 不支持持久化文件)
# 如果需要启用,设置为 true (但数据会在每次部署时重置)
ENABLE_ANALYTICS=false
```

---

## 🔧 部署步骤

### 步骤 1: 导入 GitHub 仓库

1. 访问 https://vercel.com/new
2. 点击 "Import Git Repository"
3. 选择 `Backtthefuture/jiangzao`
4. 点击 "Import"

### 步骤 2: 配置项目

| 配置项 | 值 |
|--------|-----|
| Framework Preset | Next.js (自动检测) |
| Root Directory | `./` (默认) |
| Build Command | `npm run build` (默认) |
| Output Directory | `.next` (默认) |
| Install Command | `npm install` (默认) |

### 步骤 3: 添加环境变量

1. 在 "Environment Variables" 部分
2. 逐一添加上面列出的所有环境变量
3. 确保每个变量都在 **Production**, **Preview**, **Development** 三个环境中都添加

**重要**:
- `NEXT_PUBLIC_` 开头的变量会被打包到客户端代码中,确保不包含敏感信息
- `NEXT_PUBLIC_SITE_URL` 必须设置为你的 Vercel 域名 (部署后获取)

### 步骤 4: 部署

1. 检查所有配置无误
2. 点击 "Deploy" 按钮
3. 等待构建完成 (约 2-3 分钟)

### 步骤 5: 获取域名并更新配置

部署成功后:

1. **获取 Vercel 域名**:
   - 例如: `https://jiangzao.vercel.app`
   - 或绑定自定义域名

2. **更新 Vercel 环境变量**:
   ```bash
   NEXT_PUBLIC_SITE_URL=https://jiangzao.vercel.app  # 改为你的实际域名
   ZPAY_CALLBACK_URL=https://jiangzao.vercel.app/api/payment/callback
   ```

3. **重新部署**:
   - Settings → Deployments → 最新部署 → "Redeploy"

---

## 🔐 第三方服务配置

### 1. Supabase 配置

登录 Supabase Dashboard → Settings → Authentication:

**Site URL**:
```
https://jiangzao.vercel.app
```

**Redirect URLs** (添加以下所有 URL):
```
https://jiangzao.vercel.app/api/auth/callback
https://jiangzao.vercel.app/auth/*
https://jiangzao.vercel.app/auth/login
https://jiangzao.vercel.app/auth/signup
```

### 2. Z-Pay 配置

登录 Z-Pay 商户后台 → 支付配置:

**支付回调 URL**:
```
https://jiangzao.vercel.app/api/payment/callback
```

### 3. Feishu 飞书配置

无需修改,只要环境变量配置正确即可。

---

## ⚠️ 重要注意事项

### SQLite 数据库限制

**问题**: Vercel 是无服务器(Serverless)环境,不支持持久化文件存储。

**当前方案**:
- ✅ 已禁用 SQLite 分析功能 (`ENABLE_ANALYTICS=false`)
- ✅ 所有分析 API 返回安全的默认值 (viewCount: 0, clickCount: 0)
- ✅ 不影响其他核心功能 (内容展示、登录、支付、砍价等)

**影响**:
- ❌ 浏览量和点击量不会被记录
- ❌ 详情页和卡片上不会显示统计数据
- ✅ 网站其他功能完全正常

**未来升级方案** (推荐):
- 将 SQLite 迁移到 Supabase PostgreSQL
- 创建 `analytics` 表存储浏览量和点击量
- 修改 `lib/db.ts` 使用 Supabase Client

---

## ✅ 部署后检查清单

### 1. 基础功能测试

- [ ] 首页正常加载,显示内容列表
- [ ] 点击内容卡片,详情页正常显示
- [ ] Markdown 渲染正常,代码高亮生效
- [ ] 标签和嘉宾筛选功能正常

### 2. 认证功能测试

- [ ] 注册新账号,收到验证邮件
- [ ] 点击邮件验证链接,跳转成功
- [ ] 登录功能正常,右上角立即显示用户菜单
- [ ] 登出功能正常,立即显示登录按钮
- [ ] 多标签页状态同步正常

### 3. 内容访问控制测试

- [ ] 未登录用户:前 3 篇可看,第 4 篇被截断
- [ ] 登录用户:前 10 篇可看,第 11 篇被截断
- [ ] 阅读历史页面正常显示

### 4. 支付功能测试

- [ ] 访问 `/pricing` 页面,套餐显示正常
- [ ] 点击"立即购买",跳转到 Z-Pay 支付页面
- [ ] 支付回调正常,会员状态更新

### 5. 砍价功能测试

- [ ] 月会员套餐显示"摇一摇神秘优惠"按钮
- [ ] 点击按钮,弹窗正常显示
- [ ] 输入理由,AI 评估正常返回折扣
- [ ] 使用优惠券购买,价格正确

### 6. 性能测试

- [ ] 首页加载时间 < 2秒
- [ ] 详情页加载时间 < 2秒
- [ ] ISR 缓存生效 (刷新页面,速度明显提升)

---

## 🐛 常见问题排查

### 问题1: 构建失败 - "Module not found"

**原因**: 缺少依赖包

**解决**:
```bash
# 本地测试构建
npm run build

# 检查 package.json 是否有遗漏的依赖
npm install
```

### 问题2: 构建错误 - "Dynamic server usage: Route couldn't be rendered statically"

**原因**: API 路由使用了动态特性（cookies, searchParams）但没有标记为动态渲染

**解决方案**: V1.4.3 已修复
- 所有使用 cookies 或 searchParams 的路由已添加 `export const dynamic = 'force-dynamic'`
- 如果你在早期版本遇到此问题，请更新到 V1.4.3 或更高版本

### 问题3: 运行时错误 - "Cannot find module 'better-sqlite3'"

**原因**: `ENABLE_ANALYTICS` 环境变量未设置

**解决**:
在 Vercel 环境变量中添加:
```bash
ENABLE_ANALYTICS=false
```

### 问题4: 登录后跳转失败

**原因**: Supabase Redirect URLs 未正确配置

**解决**:
1. 检查 Supabase Dashboard → Authentication → URL Configuration
2. 确保添加了所有回调 URL
3. 确保 `NEXT_PUBLIC_SITE_URL` 与 Vercel 域名一致

### 问题5: 支付回调失败

**原因**: Z-Pay 回调 URL 未更新

**解决**:
1. 检查 Z-Pay 商户后台回调 URL
2. 确保 `ZPAY_CALLBACK_URL` 环境变量正确
3. 查看 Vercel Functions 日志 (Dashboard → Functions → Logs)

### 问题6: 图片加载失败

**原因**: Feishu 图片 URL 过期 (24小时过期)

**解决**:
- Next.js ISR 自动刷新 (6小时)
- 手动触发重新验证: `POST /api/revalidate?secret=your_secret`

---

## 📊 监控和日志

### Vercel Dashboard 监控

**访问路径**: Vercel Dashboard → 项目 → Monitoring

可查看:
- 部署历史
- Function 执行日志
- 错误日志
- 性能指标

### 关键日志位置

```bash
# 查看 API 日志
Vercel Dashboard → Functions → Logs → 选择 API 路由

# 常用 API 路由:
- /api/auth/login
- /api/auth/logout
- /api/payment/create-order
- /api/payment/callback
- /api/bargain/submit
```

---

## 🚀 持续部署 (CI/CD)

Vercel 自动监听 GitHub main 分支:

**流程**:
```
Git Push → GitHub → Vercel 自动构建 → 自动部署
```

**特性**:
- ✅ 每次 push 到 main 分支自动部署
- ✅ Pull Request 自动创建预览部署
- ✅ 回滚到任何历史版本
- ✅ 自定义域名自动 SSL

---

## 📚 相关文档

- [Vercel 官方文档](https://vercel.com/docs)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
- [Supabase 文档](https://supabase.com/docs)
- [项目 PRD 文档](./prd.md)
- [飞书配置指南](./飞书配置指南.md)
- [Supabase 认证文档](./SUPABASE_AUTH.md)

---

## 🆘 需要帮助?

遇到问题可以:

1. 查看 Vercel 部署日志
2. 查看浏览器控制台错误
3. 查看 Supabase 日志
4. 查看项目 GitHub Issues

---

**最后更新**: 2025-11-05
**版本**: V1.4.3 (Vercel 部署支持 - 修复动态路由问题)
