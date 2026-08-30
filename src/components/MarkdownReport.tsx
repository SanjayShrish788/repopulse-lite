import React from "react";
import Markdown from "react-markdown";

interface MarkdownReportProps {
  report: string;
}

export function MarkdownReport({ report }: MarkdownReportProps) {
  return (
    <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-full text-zinc-800 dark:text-zinc-200">
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        Executive Risk Report
      </h2>
      <div className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
        <Markdown
          components={{
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-8 mb-4" {...props} />,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-6 mb-3" {...props} />,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mt-5 mb-2" {...props} />,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            li: ({ node, ...props }) => <li className="pl-1" {...props} />,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            strong: ({ node, ...props }) => <strong className="font-semibold text-zinc-900 dark:text-zinc-100" {...props} />,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            blockquote: ({ node, ...props }) => (
              <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 italic text-zinc-600 dark:text-zinc-400 my-4" {...props} />
            ),
          }}
        >
          {report}
        </Markdown>
      </div>
    </div>
  );
}
