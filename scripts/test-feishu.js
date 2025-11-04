// 测试飞书API
const fs = require('fs');
const path = require('path');

// 读取项目根目录的 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

async function test() {
  const FEISHU_APP_ID = envVars.FEISHU_APP_ID;
  const FEISHU_APP_SECRET = envVars.FEISHU_APP_SECRET;
  const FEISHU_BASE_ID = envVars.FEISHU_BASE_ID;
  const FEISHU_TABLE_ID = envVars.FEISHU_TABLE_ID;
  console.log('🔍 测试飞书配置...\n');

  // 1. 获取Access Token
  console.log('1️⃣ 获取Access Token...');
  const tokenResponse = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
    }
  );

  const tokenData = await tokenResponse.json();
  console.log('   Token获取结果:', tokenData.code === 0 ? '✅ 成功' : '❌ 失败');

  if (tokenData.code !== 0) {
    console.error('   错误:', tokenData);
    return;
  }

  const token = tokenData.tenant_access_token;

  // 2. 获取记录列表
  console.log('\n2️⃣ 获取记录列表...');
  const recordsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_ID}/tables/${FEISHU_TABLE_ID}/records?page_size=100`;

  const recordsResponse = await fetch(recordsUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const recordsData = await recordsResponse.json();
  console.log('   记录获取结果:', recordsData.code === 0 ? '✅ 成功' : '❌ 失败');

  if (recordsData.code !== 0) {
    console.error('   错误:', recordsData);
    return;
  }

  const items = recordsData.data.items || [];
  console.log(`   总记录数: ${items.length}`);

  // 3. 分析记录
  console.log('\n3️⃣ 分析记录...');
  const published = items.filter(item => item.fields['状态'] === '已发布');
  const draft = items.filter(item => item.fields['状态'] === '草稿');

  console.log(`   已发布: ${published.length} 条`);
  console.log(`   草稿: ${draft.length} 条`);
  console.log(`   其他: ${items.length - published.length - draft.length} 条`);

  // 4. 显示已发布的记录
  if (published.length > 0) {
    console.log('\n4️⃣ 已发布的记录:');
    published.forEach((item, index) => {
      console.log(`\n   [${index + 1}] ${item.fields['标题'] || '(无标题)'}`);
      console.log(`       嘉宾: ${item.fields['嘉宾'] || '(无嘉宾)'}`);
      console.log(`       来源: ${item.fields['来源平台'] || '(无来源)'}`);
      console.log(`       状态: ${item.fields['状态']}`);
      console.log(`       标签: ${(item.fields['标签'] || []).join(', ') || '(无标签)'}`);
      console.log(`       封面图: ${item.fields['封面图']?.length > 0 ? '✅ 有' : '❌ 无'}`);
      console.log(`       金句数: ${[1,2,3,4,5].filter(i => item.fields[`金句${i}`]).length}`);
      console.log(`       正文: ${item.fields['摘要正文'] ? `${item.fields['摘要正文'].substring(0, 50)}...` : '(无正文)'}`);
    });
  } else {
    console.log('\n4️⃣ ⚠️  未找到已发布的记录！');
    console.log('   请在飞书多维表格中：');
    console.log('   1. 填写完整的必填字段（标题、嘉宾、来源平台、封面图、标签、金句1-3、摘要正文、原内容链接、发布时间）');
    console.log('   2. 将"状态"字段改为"已发布"');
  }

  // 5. 显示所有记录的状态字段
  console.log('\n5️⃣ 所有记录的状态:');
  items.forEach((item, index) => {
    console.log(`   [${index + 1}] ${item.fields['标题'] || '(无标题)'} - 状态: ${item.fields['状态'] || '(无状态)'}`);
  });

  console.log('\n✅ 测试完成！');
}

test().catch(console.error);
