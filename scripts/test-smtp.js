// SMTP配置测试脚本
// 运行: node scripts/test-smtp.js

const nodemailer = require('nodemailer');

// 从环境变量读取配置，或者手动填写
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com', // 替换为你的Gmail
    pass: process.env.SMTP_PASS || 'your-app-password',    // 替换为应用专用密码
  },
};

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com'; // 替换为测试邮箱

async function testSMTP() {
  console.log('🔍 测试SMTP配置...\n');
  console.log('配置信息:');
  console.log(`  Host: ${SMTP_CONFIG.host}`);
  console.log(`  Port: ${SMTP_CONFIG.port}`);
  console.log(`  User: ${SMTP_CONFIG.auth.user}`);
  console.log(`  Pass: ${SMTP_CONFIG.auth.pass.substring(0, 4)}****\n`);

  try {
    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    console.log('✓ 正在验证SMTP连接...');
    await transporter.verify();
    console.log('✓ SMTP连接成功！\n');

    console.log('✓ 正在发送测试邮件...');
    const info = await transporter.sendMail({
      from: `"降噪" <${SMTP_CONFIG.auth.user}>`,
      to: TEST_EMAIL,
      subject: 'Supabase SMTP测试邮件',
      text: '如果你收到这封邮件，说明SMTP配置成功！',
      html: '<p>如果你收到这封邮件，说明<strong>SMTP配置成功</strong>！</p>',
    });

    console.log('✅ 测试邮件发送成功！');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   收件人: ${TEST_EMAIL}\n`);
    console.log('请检查邮箱（包括垃圾邮件文件夹）是否收到测试邮件。');
  } catch (error) {
    console.error('❌ SMTP测试失败:\n');
    console.error(error.message);

    if (error.code === 'EAUTH') {
      console.error('\n💡 提示: 认证失败，请检查:');
      console.error('   1. Gmail邮箱地址是否正确');
      console.error('   2. 应用专用密码是否正确（16位，无空格）');
      console.error('   3. 是否已开启Gmail两步验证');
    } else if (error.code === 'ECONNECTION') {
      console.error('\n💡 提示: 连接失败，请检查:');
      console.error('   1. SMTP_HOST 和 SMTP_PORT 是否正确');
      console.error('   2. 网络连接是否正常');
    }
  }
}

testSMTP();
