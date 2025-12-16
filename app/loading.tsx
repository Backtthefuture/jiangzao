export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border overflow-hidden animate-pulse"
          >
            <div className="flex flex-col sm:flex-row">
              {/* Skeleton Image */}
              <div className="sm:w-1/3 h-48 sm:h-auto bg-gray-200"></div>

              {/* Skeleton Content */}
              <div className="flex-1 p-6 space-y-4">
                {/* Title skeleton */}
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>

                {/* Guest skeleton */}
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>

                {/* Quote skeleton */}
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>

                {/* Tags skeleton */}
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
