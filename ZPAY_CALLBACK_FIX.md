# Z-Pay 支付回调问题 - 完整解决方案

## 📋 问题描述

**症状**:
- 用户支付成功，Z-Pay 后台显示"已付款，未通知"
- Supabase `orders` 表中订单状态为 `pending`
- 会员未激活

**根本原因**: Z-Pay 回调请求失败，未收到正确的 "success" 响应

---

## 🔍 问题分析

根据 Z-Pay 官方文档和代码分析，发现 **5 个关键问题**：

### 问题 1: 请求方法不匹配 ⚠️ **最严重**

**Z-Pay 文档说明**:
> 请求方法：GET

**原代码问题**:
```typescript
// 只处理 POST，拒绝 GET
export async function POST(request: Request) { ... }
export async function GET() {
  return new Response('Method Not Allowed', { status: 405 }); // ❌
}
```

**影响**: Z-Pay 发送 GET 请求，服务器返回 405 错误，Z-Pay 认为回调失败。

---

### 问题 2: Vercel 环境变量未配置

**本地配置** (`.env.local`):
```bash
ZPAY_PID=2025062920440492
ZPAY_KEY=tNeFjVxC3b8IlgNJvqFA9oRNxy9ShaA1
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # ❌ 本地地址
```

**Vercel 需要的配置**:
```bash
ZPAY_PID=2025062920440492
ZPAY_KEY=tNeFjVxC3b8IlgNJvqFA9oRNxy9ShaA1
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app  # ✅ 实际域名
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...  # ✅ 必须配置
```

---

### 问题 3: 环境变量配置错误 - 回调地址使用了 localhost

**重要说明**: Z-Pay **没有**商户后台统一配置回调地址的功能。回调地址是在每次创建订单时通过 `notify_url` 参数传递的。

**问题根源**:

你的环境变量配置：
```bash
# .env.local (本地开发)
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # ❌ 本地地址
```

导致创建订单时传给 Z-Pay 的回调地址是：
```
http://localhost:3000/api/payment/callback  # ❌ Z-Pay 无法访问
```

**正确配置**:

Vercel 环境变量应设置为：
```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app  # ✅ 实际域名
```

这样创建订单时传给 Z-Pay 的回调地址才是：
```
https://your-domain.vercel.app/api/payment/callback  # ✅ Z-Pay 可以访问
```

---

### 问题 4: Content-Type 检查过严

原代码在 POST 处理中检查 Content-Type，但 GET 请求不需要 Content-Type，这会导致误判。

---

### 问题 5: 缺少日志监控

Vercel 上出错时，没有足够的日志信息来定位问题。

---

## ✅ 解决方案

### 1. 代码已修复

**修改内容**:
- ✅ 支持 GET 和 POST 两种请求方式
- ✅ 统一的回调处理逻辑 (`handleCallback`)
- ✅ 移除 Content-Type 检查
- ✅ 增强日志输出

**新的回调处理流程**:
```
GET/POST 请求
  ↓
解析参数 (Query String / Form Data)
  ↓
handleCallback() 统一处理
  ├─ 1. 验证参数完整性
  ├─ 2. 验证签名
  ├─ 3. 验证商户 ID
  ├─ 4. 验证交易状态
  ├─ 5. 查询订单
  ├─ 6. 幂等性检查
  ├─ 7. 验证金额
  ├─ 8. 更新订单状态 (pending → paid)
  ├─ 9. 激活会员
  ├─ 10. 标记优惠券已使用
  ├─ 11. 更新订单状态 (paid → completed)
  └─ 12. 返回 "success"
```

---

### 2. Vercel 环境变量配置

**步骤**:

1. 打开 Vercel Dashboard
2. 选择项目 → Settings → Environment Variables
3. 添加以下变量（**所有环境**: Production, Preview, Development）:

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `ZPAY_PID` | `2025062920440492` | Z-Pay 商户 ID |
| `ZPAY_KEY` | `tNeFjVxC3b8IlgNJvqFA9oRNxy9ShaA1` | Z-Pay 密钥 |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.vercel.app` | **替换为实际域名** |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Supabase Service Role Key |

4. 重新部署项目（Settings → Deployments → Redeploy）

---

### 3. 重要提醒：旧订单无法自动修复

**关键信息**：

Z-Pay 的回调地址是在**创建订单时**传递的，而不是商户后台统一配置的。这意味着：

1. **旧订单**（在修复环境变量之前创建的）：
   - 回调地址已经写死为 `http://localhost:3000/api/payment/callback`
   - Z-Pay 无法访问 localhost，所以永远回调失败
   - **必须手动处理**（见下方"方法 2"）

2. **新订单**（修复环境变量后创建的）：
   - 回调地址自动使用正确的 Vercel 域名
   - Z-Pay 可以正常回调
   - 无需额外操作

**建议**：
- 优先发起新订单测试，确认回调已修复
- 对于旧订单，使用手动处理或等待用户联系客服

---

## 🧪 测试验证

### 方法 1: 重新发起支付测试

1. 在你的平台发起一笔新的支付订单
2. 使用小额金额（例如 ¥0.01）进行测试
3. 完成支付
4. 观察：
   - Z-Pay 后台是否显示"已通知"
   - Supabase `orders` 表中订单状态是否变为 `completed`
   - 会员是否激活成功

---

### 方法 2: 手动处理旧订单（重要！）

**为什么旧订单无法自动修复**：

旧订单创建时传给 Z-Pay 的回调地址是 `http://localhost:3000/api/payment/callback`，Z-Pay 无法访问 localhost，所以即使你修复了代码和环境变量，**Z-Pay 也无法重新通知**。

**手动处理步骤**：

1. 在 Supabase 查询所有 pending 状态的订单：
   ```sql
   SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC;
   ```

2. 确认这些订单在 Z-Pay 后台确实已支付成功

3. 对每个已支付的订单，运行以下 SQL：

   ```sql
   -- 1. 更新订单状态
   UPDATE orders
   SET
     status = 'completed',
     callback_received_at = NOW(),
     updated_at = NOW()
   WHERE order_id = 'JZ_实际订单号';  -- 替换为实际订单号

   -- 2. 激活会员（根据 product_type 调整）
   -- 月会员示例
   INSERT INTO memberships (
     id,
     user_id,
     user_email,
     tier,
     status,
     started_at,
     expires_at
   )
   SELECT
     gen_random_uuid(),
     user_id,
     user_email,
     product_type::text,  -- 使用订单中的 product_type
     'active',
     NOW(),
     CASE
       WHEN product_type = 'monthly' THEN NOW() + INTERVAL '1 month'
       WHEN product_type = 'yearly' THEN NOW() + INTERVAL '1 year'
       WHEN product_type = 'lifetime' THEN NULL  -- 终身会员无过期时间
     END
   FROM orders
   WHERE order_id = 'JZ_实际订单号'
   ON CONFLICT (user_id)
   DO UPDATE SET
     tier = EXCLUDED.tier,
     status = 'active',
     expires_at = CASE
       WHEN EXCLUDED.tier = 'lifetime' THEN NULL
       ELSE GREATEST(memberships.expires_at, NOW()) +
            CASE
              WHEN EXCLUDED.tier = 'monthly' THEN INTERVAL '1 month'
              WHEN EXCLUDED.tier = 'yearly' THEN INTERVAL '1 year'
            END
     END,
     updated_at = NOW();
   ```

4. 通知用户会员已激活（如果需要）

---

### 方法 3: 使用测试脚本模拟回调

创建测试脚本 `test-zpay-callback.sh`:

```bash
#!/bin/bash

# 配置
CALLBACK_URL="https://your-domain.vercel.app/api/payment/callback"
ZPAY_KEY="tNeFjVxC3b8IlgNJvqFA9oRNxy9ShaA1"
PID="2025062920440492"

# 测试订单信息（从你的 Supabase orders 表中获取）
OUT_TRADE_NO="JZ_20251104_1730720000000_A1B2C3"  # 替换为实际订单号
TRADE_NO="20241104123456789"  # Z-Pay 交易号
MONEY="9.90"  # 订单金额
NAME="降噪平台月会员"
TYPE="wxpay"
TRADE_STATUS="TRADE_SUCCESS"

# 构造签名字符串（按字母顺序排序）
SIGN_STR="money=${MONEY}&name=${NAME}&out_trade_no=${OUT_TRADE_NO}&pid=${PID}&trade_no=${TRADE_NO}&trade_status=${TRADE_STATUS}&type=${TYPE}${ZPAY_KEY}"

# 生成 MD5 签名（需要安装 md5sum 或 md5 工具）
if command -v md5sum &> /dev/null; then
    SIGN=$(echo -n "$SIGN_STR" | md5sum | awk '{print $1}')
elif command -v md5 &> /dev/null; then
    SIGN=$(echo -n "$SIGN_STR" | md5)
else
    echo "❌ 错误: 未找到 md5 或 md5sum 工具"
    exit 1
fi

echo "📝 签名字符串: $SIGN_STR"
echo "🔐 生成签名: $SIGN"
echo ""

# 发送 GET 请求
echo "🚀 发送 GET 回调请求..."
RESPONSE=$(curl -w "\nHTTP Status: %{http_code}" -X GET "${CALLBACK_URL}?pid=${PID}&trade_no=${TRADE_NO}&out_trade_no=${OUT_TRADE_NO}&type=${TYPE}&name=${NAME}&money=${MONEY}&trade_status=${TRADE_STATUS}&sign=${SIGN}&sign_type=MD5")

echo "📥 响应:"
echo "$RESPONSE"
echo ""

# 验证响应
if [[ "$RESPONSE" == *"success"* ]]; then
    echo "✅ 测试成功！回调处理正常"
else
    echo "❌ 测试失败！响应内容不是 'success'"
fi
```

**使用方法**:
```bash
chmod +x test-zpay-callback.sh
./test-zpay-callback.sh
```

---

### 方法 4: 查看 Vercel Function Logs

**步骤**:

1. 打开 Vercel Dashboard
2. 选择项目 → Functions → `/api/payment/callback`
3. 点击 "Logs"
4. 发起支付或手动重试回调
5. 实时观察日志输出

**正常日志示例**:
```
[CALLBACK] GET 请求 { out_trade_no: 'JZ_...', trade_no: '...', ... }
[CALLBACK] 收到回调 { timestamp: '2025-11-06T...', ... }
[CALLBACK] 处理成功 { order_id: 'JZ_...', user_id: '...' }
```

**异常日志示例**:
```
[CALLBACK] 签名验证失败 { received: '...', params: {...} }
[CALLBACK] 订单不存在 JZ_...
[CALLBACK] 金额不匹配 { callback: 9.90, order: 9.99 }
```

---

## 🔍 排查清单

使用以下清单逐项检查：

### Vercel 配置
- [ ] `ZPAY_PID` 环境变量已配置
- [ ] `ZPAY_KEY` 环境变量已配置
- [ ] `NEXT_PUBLIC_SITE_URL` 设置为 Vercel 实际域名
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 已配置
- [ ] 已重新部署项目（修改环境变量后必须重新部署）

### Z-Pay 商户后台
- [ ] 回调地址配置为: `https://your-domain.vercel.app/api/payment/callback`
- [ ] 商户 ID 确认为: `2025062920440492`
- [ ] 商户密钥确认为: `tNeFjVxC3b8IlgNJvqFA9oRNxy9ShaA1`

### 代码更新
- [ ] 回调 API 支持 GET 请求
- [ ] 回调 API 支持 POST 请求
- [ ] 代码已部署到 Vercel（git push）

### Supabase 数据库
- [ ] `orders` 表存在
- [ ] `memberships` 表存在
- [ ] RLS 策略正确配置
- [ ] Service Role Key 有权限写入数据

### 网络连接
- [ ] Vercel 函数可以访问 Supabase（检查 Region 设置）
- [ ] Z-Pay 可以访问你的 Vercel 域名（检查防火墙）
- [ ] Vercel 函数未超时（30 秒限制）

---

## 📊 监控和维护

### 1. 设置告警

在 Vercel Dashboard 配置告警：
- Function 错误率 > 5%
- Function 响应时间 > 3s

### 2. 定期检查

每周检查：
- Z-Pay 后台是否有"未通知"订单
- Vercel Function Logs 是否有错误
- Supabase orders 表是否有长期 pending 订单

### 3. 日志保留

Vercel 免费版只保留最近的日志，建议：
- 升级到 Pro 版（日志保留更久）
- 或使用外部日志服务（Sentry, LogRocket）

---

## 🆘 常见问题 (FAQ)

### Q1: 为什么修改代码后还是失败？

**A**: 确保已 git push 并重新部署到 Vercel。检查 Vercel 部署历史，确认最新部署包含你的修改。

---

### Q2: 签名验证失败怎么办？

**A**: 检查以下几点：
1. `ZPAY_KEY` 环境变量是否正确
2. 环境变量修改后是否重新部署
3. 签名算法是否正确（按字母顺序排序，MD5 小写）
4. Z-Pay 发送的参数是否完整

---

### Q3: 订单更新失败但没有错误日志？

**A**: 可能是 RLS 策略问题：
1. 确认 `SUPABASE_SERVICE_ROLE_KEY` 已配置
2. 在 Supabase Dashboard 检查 RLS 策略
3. 确认 Service Role 有写入权限

---

### Q4: 如何处理历史"未通知"订单？

**A**: 三种方式：
1. **推荐**: Z-Pay 后台手动重新通知
2. 使用测试脚本模拟回调
3. 直接在 Supabase 手动更新订单状态和会员信息

**手动更新 SQL**:
```sql
-- 1. 更新订单状态
UPDATE orders
SET
  status = 'completed',
  callback_received_at = NOW(),
  updated_at = NOW()
WHERE order_id = 'JZ_20251104_1730720000000_A1B2C3';  -- 替换订单号

-- 2. 激活会员（以月会员为例）
INSERT INTO memberships (
  id,
  user_id,
  user_email,
  tier,
  status,
  started_at,
  expires_at
)
VALUES (
  gen_random_uuid(),
  'user-uuid-here',  -- 从 orders 表获取 user_id
  'user@example.com',  -- 从 orders 表获取 user_email
  'monthly',
  'active',
  NOW(),
  NOW() + INTERVAL '1 month'
)
ON CONFLICT (user_id)
DO UPDATE SET
  tier = EXCLUDED.tier,
  status = 'active',
  expires_at = GREATEST(memberships.expires_at, NOW()) + INTERVAL '1 month',
  updated_at = NOW();
```

---

### Q5: Z-Pay 回调频率是多少？

**A**: 根据文档，Z-Pay 回调策略为：
- 间隔时间: 0/15/15/30/180/1800/1800/1800/1800/3600 秒
- 共尝试 10 次
- 只有收到 "success" 才停止重试

---

### Q6: 如何测试支付回调而不实际支付？

**A**: 使用测试脚本（见上方 "方法 3"），可以完全模拟 Z-Pay 回调请求，无需实际支付。

---

## 📚 相关文档

- [Z-Pay 官方文档](https://zpayz.cn/doc.html)
- [Vercel 环境变量配置](https://vercel.com/docs/projects/environment-variables)
- [Vercel Function Logs](https://vercel.com/docs/observability/runtime-logs)
- [Supabase RLS 策略](https://supabase.com/docs/guides/auth/row-level-security)

---

## 📞 需要帮助？

如果按照本文档操作后仍然有问题：

1. **收集信息**:
   - Vercel Function Logs 截图
   - Z-Pay 后台订单详情截图
   - Supabase orders 表记录截图
   - 测试脚本的完整输出

2. **检查配置**:
   - 确认所有环境变量已配置
   - 确认 Z-Pay 回调地址正确
   - 确认代码已部署

3. **联系支持**:
   - Z-Pay 客服（如果是 Z-Pay 侧问题）
   - Vercel 支持（如果是部署问题）
   - Supabase 支持（如果是数据库问题）

---

**最后更新**: 2025-11-06
**版本**: V1.4.3
**作者**: Claude Code
