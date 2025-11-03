# Supabase 认证使用说明

## 功能概述

项目已集成Supabase认证系统，支持：
- 邮箱注册（需邮箱验证）
- 邮箱登录
- 用户状态管理
- 退出登录
- 重新发送验证邮件

## 环境配置

`.env.local` 文件中已包含Supabase配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://supabasehuang.zeabur.app/
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 文件结构

### Supabase 客户端配置

```
lib/supabase/
├── client.ts       # 客户端组件使用
├── server.ts       # 服务端组件/API路由使用
└── middleware.ts   # 中间件使用
```

### API 路由

```
app/api/auth/
├── signup/route.ts      # 用户注册
├── login/route.ts       # 用户登录
├── logout/route.ts      # 退出登录
├── callback/route.ts    # 邮箱验证回调
├── resend/route.ts      # 重新发送验证邮件
└── user/route.ts        # 获取当前用户信息
```

### UI 组件

```
components/auth/
├── SignupForm.tsx   # 注册表单
├── LoginForm.tsx    # 登录表单
└── UserMenu.tsx     # 用户菜单（导航栏使用）
```

### 页面路由

```
app/auth/
├── login/page.tsx            # 登录页面
├── signup/page.tsx           # 注册页面
├── callback-success/page.tsx # 验证成功页面
└── error/page.tsx            # 认证错误页面
```

## 使用示例

### 1. 用户注册

**前端调用：**

```typescript
const response = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  }),
});

const data = await response.json();
```

**响应示例：**

```json
{
  "message": "注册成功！请检查您的邮箱并点击验证链接完成注册。",
  "requiresEmailVerification": true,
  "user": { "id": "...", "email": "..." }
}
```

### 2. 用户登录

**前端调用：**

```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  }),
});

const data = await response.json();
```

**响应示例：**

```json
{
  "message": "登录成功！",
  "user": { "id": "...", "email": "..." },
  "session": { "access_token": "...", "refresh_token": "..." }
}
```

### 3. 退出登录

**前端调用：**

```typescript
const response = await fetch('/api/auth/logout', {
  method: 'POST',
});

const data = await response.json();
```

### 4. 获取当前用户

**前端调用：**

```typescript
const response = await fetch('/api/auth/user');
const data = await response.json();

if (response.ok) {
  console.log('当前用户:', data.user);
} else {
  console.log('未登录');
}
```

### 5. 在服务端组件中获取用户

```typescript
import { createClient } from '@/lib/supabase/server';

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>请先登录</div>;
  }

  return <div>欢迎，{user.email}</div>;
}
```

### 6. 在客户端组件中获取用户

```typescript
'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function Component() {
  const [user, setUser] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  return <div>{user ? user.email : '未登录'}</div>;
}
```

## UI 组件使用

### 在导航栏中集成用户菜单

```typescript
import UserMenu from '@/components/auth/UserMenu';

export default function Navbar() {
  return (
    <nav>
      <div>Logo</div>
      <UserMenu />
    </nav>
  );
}
```

## 路由保护

中间件已配置路由保护逻辑（`middleware.ts`）：

- 允许匿名访问：`/`, `/auth/*`, `/api/auth/*`, `/tags/*`, `/guests/*`, `/content/*`
- 其他路由需要登录，未登录用户会被重定向到 `/auth/login`

### 自定义受保护路由

修改 `lib/supabase/middleware.ts` 中的条件：

```typescript
if (
  !user &&
  !request.nextUrl.pathname.startsWith('/auth') &&
  !request.nextUrl.pathname.startsWith('/api/auth') &&
  request.nextUrl.pathname !== '/' &&
  // 添加你的公开路由
  !request.nextUrl.pathname.startsWith('/public-route')
) {
  const url = request.nextUrl.clone();
  url.pathname = '/auth/login';
  return NextResponse.redirect(url);
}
```

## 邮箱验证流程

1. 用户在 `/auth/signup` 注册
2. Supabase发送验证邮件到用户邮箱
3. 用户点击邮件中的链接
4. 链接跳转到 `/api/auth/callback?code=xxx`
5. 回调处理后重定向到 `/auth/callback-success`
6. 用户完成验证，可以正常登录

### Supabase 邮件模板配置

在Supabase Dashboard中配置邮件模板：

1. 进入项目的 Authentication > Email Templates
2. 确保 "Confirm signup" 模板的确认链接指向：
   ```
   {{ .SiteURL }}/api/auth/callback?code={{ .Token }}
   ```

## 常见错误处理

### 邮箱未验证

```json
{
  "error": "请先验证您的邮箱"
}
```

**解决方案：** 用户需要查收邮件并点击验证链接，或在注册页面重新发送验证邮件。

### 邮箱或密码错误

```json
{
  "error": "邮箱或密码错误"
}
```

**解决方案：** 检查输入的邮箱和密码是否正确。

### 密码长度不足

```json
{
  "error": "密码长度至少为6位"
}
```

**解决方案：** 使用至少6位字符的密码。

## 安全性说明

- 所有密码通过Supabase自动加密存储
- Session通过HttpOnly Cookie管理，防止XSS攻击
- 中间件自动刷新过期的session
- 支持CSRF保护

## 页面访问地址

- 登录页面：`http://localhost:3003/auth/login`
- 注册页面：`http://localhost:3003/auth/signup`
- 验证成功页面：`http://localhost:3003/auth/callback-success`
- 错误页面：`http://localhost:3003/auth/error`

## 开发提示

1. 开发环境中，Supabase可能会跳过邮箱验证（取决于配置）
2. 生产环境务必启用邮箱验证
3. 测试时可以在Supabase Dashboard中手动验证用户
4. 查看用户列表：Supabase Dashboard > Authentication > Users

## 扩展功能建议

以下功能可以根据需求添加：

1. **密码重置**
   - API路由：`/api/auth/reset-password`
   - 页面：`/auth/reset-password`

2. **OAuth登录**（Google、GitHub等）
   - 在Supabase Dashboard启用Provider
   - 添加对应的登录按钮

3. **用户资料管理**
   - API路由：`/api/auth/profile`
   - 页面：`/auth/profile`

4. **邮箱修改**
   - API路由：`/api/auth/update-email`
   - 需要重新验证

5. **多因素认证（MFA）**
   - Supabase支持TOTP
   - 添加MFA设置页面
