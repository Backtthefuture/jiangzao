export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">关于降噪</h1>

      <div className="prose prose-lg">
        <p className="text-xl text-gray-700 leading-relaxed">
          降噪是一个专注于AI行业访谈精华的策展平台。
        </p>

        <h2>策展理念</h2>
        <p>
          在信息过载的时代,我们相信<strong>人工精选 + AI摘要</strong>
          的价值。创始人从小宇宙、B站、YouTube等平台精选高质量AI行业访谈,
          使用AI生成2000字左右的精华摘要和3-5条关键金句,
          帮助从业者快速获取有价值的行业洞察。
        </p>

        <blockquote>
          {'"你只需要来我的网站,就能知道最近上线的高质量AI访谈内容是哪些,以及哪些关键内容值得你看。"'}
        </blockquote>

        <h2>核心价值</h2>
        <ul>
          <li>
            <strong>降低信息噪音</strong>: 人工精选,确保内容质量
          </li>
          <li>
            <strong>节省时间</strong>:
            通过AI摘要和金句,快速了解访谈核心内容
          </li>
          <li>
            <strong>垂直聚焦</strong>: 专注AI行业,建立专业形象
          </li>
          <li>
            <strong>促进完整收听</strong>: 提供原内容链接,导流至原平台
          </li>
        </ul>

        <h2>联系方式</h2>
        <p>如有建议或合作意向,欢迎联系:</p>
        <ul>
          <li>邮箱: contact@example.com</li>
          <li>Twitter: @jiangzao</li>
        </ul>
      </div>
    </div>
  );
}
