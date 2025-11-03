// 临时脚本：通过API禁用Supabase邮箱验证
// 运行: node scripts/disable-email-verification.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // 需要service role key

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('错误：缺少环境变量');
  console.log('需要设置:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY (在Supabase Dashboard > Settings > API)');
  process.exit(1);
}

async function disableEmailConfirmation() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({
        DISABLE_SIGNUP: false,
        MAILER_AUTOCONFIRM: true, // 自动确认邮箱
      }),
    });

    if (response.ok) {
      console.log('✅ 成功禁用邮箱验证！');
      console.log('现在用户注册后可以直接登录，无需验证邮箱。');
    } else {
      const error = await response.text();
      console.error('❌ 配置失败:', error);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
  }
}

disableEmailConfirmation();
