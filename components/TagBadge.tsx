import Link from 'next/link';

interface TagBadgeProps {
  tag: string;
  href?: string;
  clickable?: boolean;
}

export default function TagBadge({ tag, href, clickable = true }: TagBadgeProps) {
  const badge = (
    <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-primary hover:text-white transition-colors cursor-pointer">
      #{tag}
    </span>
  );

  // 如果不可点击，直接返回span（避免嵌套<a>）
  if (!clickable) {
    return badge;
  }

  // 可点击时返回Link
  if (href) {
    return <Link href={href}>{badge}</Link>;
  }

  return (
    <Link href={`/tags/${encodeURIComponent(tag)}`}>{badge}</Link>
  );
}
