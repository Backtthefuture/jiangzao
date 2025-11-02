#!/usr/bin/env node

// 飞书数据诊断工具
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 读取.env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const FEISHU_APP_ID = envVars.FEISHU_APP_ID;
const FEISHU_APP_SECRET = envVars.FEISHU_APP_SECRET;
const FEISHU_BASE_ID = envVars.FEISHU_BASE_ID;
const FEISHU_TABLE_ID = envVars.FEISHU_TABLE_ID;

// 创建axios实例
const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function main() {
  console.log('🔍 飞书数据诊断工具\n');
  console.log('=' .repeat(60));

  // 1. 验证环境变量
  console.log('\n1️⃣  验证环境变量');
  console.log('-'.repeat(60));
  console.log(`   FEISHU_APP_ID: ${FEISHU_APP_ID ? '✅' : '❌ 缺失'}`);
  console.log(`   FEISHU_APP_SECRET: ${FEISHU_APP_SECRET ? '✅' : '❌ 缺失'}`);
  console.log(`   FEISHU_BASE_ID: ${FEISHU_BASE_ID ? '✅' : '❌ 缺失'}`);
  console.log(`   FEISHU_TABLE_ID: ${FEISHU_TABLE_ID ? '✅' : '❌ 缺失'}`);

  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_BASE_ID || !FEISHU_TABLE_ID) {
    console.error('\n❌ 环境变量配置不完整，请检查.env.local文件');
    process.exit(1);
  }

  // 2. 获取Access Token
  console.log('\n2️⃣  获取Access Token');
  console.log('-'.repeat(60));

  let token;
  try {
    const response = await axiosInstance.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }
    );

    const data = response.data;
    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    token = data.tenant_access_token;
    console.log(`   ✅ Token获取成功`);
    console.log(`   过期时间: ${data.expire}秒`);
  } catch (error) {
    console.error(`   ❌ Token获取失败: ${error.message}`);
    process.exit(1);
  }

  // 3. 获取表格字段
  console.log('\n3️⃣  获取表格字段');
  console.log('-'.repeat(60));

  let fields = {};
  try {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_ID}/tables/${FEISHU_TABLE_ID}/fields`;
    const response = await axiosInstance.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = response.data;
    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    const items = data.data.items || [];
    console.log(`   ✅ 共有 ${items.length} 个字段`);

    // 构建字段映射
    items.forEach(item => {
      fields[item.field_name] = {
        id: item.field_id,
        type: item.type,
      };
    });

    // 检查必填字段
    const requiredFields = ['标题', '嘉宾', '来源平台', '封面图', '标签', '金句1', '金句2', '金句3', '摘要正文', '原内容链接', '状态', '发布时间'];
    console.log('\n   必填字段检查:');
    requiredFields.forEach(fieldName => {
      if (fields[fieldName]) {
        console.log(`   ✅ ${fieldName} (${fields[fieldName].type})`);
      } else {
        console.log(`   ❌ ${fieldName} - 缺失！`);
      }
    });
  } catch (error) {
    console.error(`   ❌ 获取字段失败: ${error.message}`);
    console.log('\n   可能原因:');
    console.log('   - Base ID或Table ID不正确');
    console.log('   - 应用权限不足（需要bitable:app:readonly权限）');
    process.exit(1);
  }

  // 4. 获取记录列表
  console.log('\n4️⃣  获取记录列表');
  console.log('-'.repeat(60));

  let records = [];
  try {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_ID}/tables/${FEISHU_TABLE_ID}/records`;
    const response = await axiosInstance.get(url, {
      params: {
        page_size: 100,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = response.data;
    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    records = data.data.items || [];
    console.log(`   ✅ 共有 ${records.length} 条记录`);
  } catch (error) {
    console.error(`   ❌ 获取记录失败: ${error.message}`);
    process.exit(1);
  }

  // 5. 分析记录
  console.log('\n5️⃣  分析记录');
  console.log('-'.repeat(60));

  const statuses = {};
  const published = [];
  const draft = [];
  const other = [];

  records.forEach(record => {
    const status = record.fields['状态'];
    statuses[status] = (statuses[status] || 0) + 1;

    if (status === '已发布') {
      published.push(record);
    } else if (status === '草稿') {
      draft.push(record);
    } else {
      other.push(record);
    }
  });

  console.log('   状态统计:');
  Object.entries(statuses).forEach(([status, count]) => {
    console.log(`   - ${status || '(空)'}: ${count} 条`);
  });

  console.log(`\n   ✅ 已发布: ${published.length} 条`);
  console.log(`   📝 草稿: ${draft.length} 条`);
  console.log(`   ❓ 其他: ${other.length} 条`);

  // 6. 检查已发布的记录
  if (published.length > 0) {
    console.log('\n6️⃣  已发布记录详情');
    console.log('-'.repeat(60));

    published.forEach((record, index) => {
      console.log(`\n   [${index + 1}] ${record.fields['标题'] || '(无标题)'}`);
      console.log(`       Record ID: ${record.record_id}`);
      console.log(`       嘉宾: ${record.fields['嘉宾'] || '❌ 缺失'}`);
      console.log(`       来源: ${record.fields['来源平台'] || '❌ 缺失'}`);
      console.log(`       标签: ${(record.fields['标签'] || []).join(', ') || '❌ 缺失'}`);
      console.log(`       封面图: ${record.fields['封面图']?.length > 0 ? '✅ 有 (' + record.fields['封面图'].length + ' 个文件)' : '❌ 无'}`);

      const quotes = [1,2,3,4,5].filter(i => record.fields[`金句${i}`]);
      console.log(`       金句: ${quotes.length >= 3 ? '✅' : '⚠️'} ${quotes.length} 条 (至少需要3条)`);

      console.log(`       正文: ${record.fields['摘要正文'] ? '✅ ' + record.fields['摘要正文'].length + ' 字符' : '❌ 缺失'}`);
      console.log(`       原链接: ${record.fields['原内容链接'] ? '✅ 有' : '❌ 缺失'}`);
      console.log(`       发布时间: ${record.fields['发布时间'] || '❌ 缺失'}`);

      // 数据完整性检查
      const requiredFields = ['标题', '嘉宾', '来源平台', '标签', '摘要正文', '原内容链接', '发布时间'];
      const missingFields = requiredFields.filter(f => !record.fields[f] || (Array.isArray(record.fields[f]) && record.fields[f].length === 0));

      if (missingFields.length === 0 && quotes.length >= 3 && record.fields['封面图']?.length > 0) {
        console.log(`       ✅ 数据完整`);
      } else {
        console.log(`       ⚠️  缺少字段: ${missingFields.join(', ')}${quotes.length < 3 ? ', 金句不足' : ''}${!record.fields['封面图']?.length ? ', 封面图' : ''}`);
      }
    });
  } else {
    console.log('\n6️⃣  ⚠️  未找到已发布的记录！');
    console.log('-'.repeat(60));
    console.log('\n   请在飞书多维表格中：');
    console.log('   1. 填写完整的必填字段');
    console.log('   2. 将"状态"字段改为"已发布"（注意大小写和标点）');
    console.log('   3. 保存后刷新网站');

    if (draft.length > 0) {
      console.log(`\n   💡 你有 ${draft.length} 条草稿，可以选择其中一条修改为"已发布"状态`);
    }
  }

  // 7. 总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 诊断总结');
  console.log('='.repeat(60));

  console.log(`\n   总记录数: ${records.length}`);
  console.log(`   已发布: ${published.length}`);
  console.log(`   草稿: ${draft.length}`);

  if (published.length > 0) {
    console.log('\n   ✅ 数据正常！网站应该能显示内容。');
    console.log('\n   如果网站仍无内容，请：');
    console.log('   1. 刷新浏览器（Cmd/Ctrl + Shift + R）');
    console.log('   2. 重启开发服务器（npm run dev）');
    console.log('   3. 调用刷新API（curl -X POST http://localhost:3001/api/revalidate）');
  } else {
    console.log('\n   ⚠️  没有已发布的内容！');
    console.log('\n   解决方法：');
    console.log('   1. 在飞书表格中至少创建一条记录');
    console.log('   2. 填写所有必填字段');
    console.log('   3. 将"状态"改为"已发布"');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 诊断完成！\n');
}

main().catch(error => {
  console.error('\n❌ 诊断失败:', error.message);
  process.exit(1);
});
