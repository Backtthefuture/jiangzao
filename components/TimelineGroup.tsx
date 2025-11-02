import TimelineCard from './TimelineCard';
import { DateGroup } from '@/lib/types';

interface TimelineGroupProps {
  group: DateGroup;
}

export default function TimelineGroup({ group }: TimelineGroupProps) {
  return (
    <div className="timeline-group mb-20">
      {/* 分组标题 */}
      <div className="group-header flex items-center gap-4 mb-10">
        <h2 className="group-title text-[1.75rem] font-bold text-gray-900 whitespace-nowrap">
          📅 {group.dateLabel}
        </h2>
        <div className="group-line flex-1 h-0.5 bg-gradient-to-r from-gray-300 to-transparent" />
      </div>

      {/* 时间轴容器 */}
      <div className="timeline relative pl-40 max-md:pl-10 before:content-[''] before:absolute before:left-20 before:top-0 before:bottom-0 before:w-0.5 before:bg-[#007AFF] max-md:before:left-0">
        {group.contents.map((content, index) => (
          <div
            key={content.id}
            className="animate-slideIn"
            style={{
              animationDelay: `${index * 0.1}s`,
              animationFillMode: 'backwards',
            }}
          >
            <TimelineCard content={content} />
          </div>
        ))}
      </div>
    </div>
  );
}
