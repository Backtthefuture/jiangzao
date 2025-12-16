import Link from 'next/link';
// import UserMenu from '@/components/auth/UserMenu';

export default function Header() {
  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-primary">降噪</div>
            <div className="text-sm text-secondary hidden sm:block">
              AI访谈精华策展
            </div>
          </Link>

          {/* Navigation */}
          <div className="flex items-center space-x-8">
            <nav className="flex items-center space-x-8">
              <Link
                href="/"
                className="text-gray-700 hover:text-primary transition-colors"
              >
                首页
              </Link>
              <Link
                href="/tags"
                className="text-gray-700 hover:text-primary transition-colors"
              >
                标签
              </Link>
              <Link
                href="/guests"
                className="text-gray-700 hover:text-primary transition-colors"
              >
                嘉宾
              </Link>
              <Link
                href="/about"
                className="text-gray-700 hover:text-primary transition-colors"
              >
                关于
              </Link>
            </nav>

            {/* User Menu - DISABLED for public access plan */}
            {/* <UserMenu /> */}
          </div>
        </div>
      </div>
    </header>
  );
}
