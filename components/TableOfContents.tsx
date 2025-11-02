'use client';

import { useEffect, useState } from 'react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  contentRef: React.RefObject<HTMLDivElement>;
}

export default function TableOfContents({ contentRef }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // 从渲染后的DOM中提取标题
  useEffect(() => {
    if (!contentRef.current) return;

    const headingElements = contentRef.current.querySelectorAll('h2, h3, h4');
    const extractedHeadings: Heading[] = Array.from(headingElements).map((el) => ({
      id: el.id,
      text: el.textContent || '',
      level: parseInt(el.tagName[1]), // h2 -> 2
    }));

    setHeadings(extractedHeadings);
  }, [contentRef]);

  // 使用 Intersection Observer 监听标题元素
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0px -80% 0px',
      }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          📚 目录
        </h2>

        <ul className="space-y-2 text-sm">
          {headings.map((heading) => {
            const isActive = activeId === heading.id;
            const paddingLeft = (heading.level - 2) * 16;

            return (
              <li
                key={heading.id}
                style={{ paddingLeft: `${paddingLeft}px` }}
              >
                <button
                  onClick={() => handleClick(heading.id)}
                  className={`
                    group flex items-start text-left w-full py-1 px-2 rounded
                    border-l-2 transition-colors
                    ${
                      isActive
                        ? 'border-primary text-primary font-medium'
                        : 'border-transparent text-gray-600 hover:text-primary'
                    }
                  `}
                >
                  <span
                    className={`
                      inline-block w-1.5 h-1.5 rounded-full mr-2 mt-1.5 shrink-0
                      ${
                        isActive
                          ? 'bg-primary'
                          : 'bg-gray-400 group-hover:bg-primary'
                      }
                    `}
                  />
                  <span className="line-clamp-2">{heading.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
