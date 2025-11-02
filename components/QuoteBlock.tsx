interface QuoteBlockProps {
  quotes: string[];
}

export default function QuoteBlock({ quotes }: QuoteBlockProps) {
  if (quotes.length === 0) return null;

  return (
    <div className="bg-gray-50 border-l-4 border-primary p-6 rounded-r-lg my-8">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="mr-2">💬</span>
        关键金句
      </h3>
      <div className="space-y-4">
        {quotes.map((quote, index) => (
          <p key={index} className="text-gray-700 italic leading-relaxed">
            {quote}
          </p>
        ))}
      </div>
    </div>
  );
}
