/** File-type glyphs for the changed-files tree. */
export function GitFileIcon({
  fileName,
  className = "w-3.5 h-3.5 shrink-0",
}: {
  fileName: string;
  className?: string;
}) {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".tsx")) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[7px] font-bold bg-[#4f7df3] text-white rounded-[2px] ${className}`}
        style={{ width: 14, height: 14 }}
      >
        TS
      </span>
    );
  }
  if (lower.endsWith(".ts")) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[7px] font-bold bg-[#3178c6] text-white rounded-[2px] ${className}`}
        style={{ width: 14, height: 14 }}
      >
        TS
      </span>
    );
  }
  if (lower.endsWith(".jsx")) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[7px] font-bold bg-[#61dafb] text-[#20232a] rounded-[2px] ${className}`}
        style={{ width: 14, height: 14 }}
      >
        JSX
      </span>
    );
  }
  if (
    lower.endsWith(".js") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs")
  ) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[7px] font-bold bg-[#f4c84f] text-black rounded-[2px] ${className}`}
        style={{ width: 14, height: 14 }}
      >
        JS
      </span>
    );
  }
  if (lower.endsWith(".json") || lower.endsWith(".jsonc")) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[7px] font-bold bg-[#83cd29] text-white rounded-[2px] ${className}`}
        style={{ width: 14, height: 14 }}
      >
        {}
      </span>
    );
  }
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="#519aba">
        <path d="M14.5 2H6.7L5.3.5H1.5C.7.5 0 1.2 0 2v12c0 .8.7 1.5 1.5 1.5h13c.8 0 1.5-.7 1.5-1.5V3.5c0-.8-.7-1.5-1.5-1.5zM13 13.5H2V3h3.6L7 4.5h6v9z" />
      </svg>
    );
  }
  if (
    lower.endsWith(".css") ||
    lower.endsWith(".scss") ||
    lower.endsWith(".less")
  ) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[7px] font-bold bg-[#563d7c] text-white rounded-[2px] ${className}`}
        style={{ width: 14, height: 14 }}
      >
        #
      </span>
    );
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[7px] font-bold bg-[#e44d26] text-white rounded-[2px] ${className}`}
        style={{ width: 14, height: 14 }}
      >
        &lt;&gt;
      </span>
    );
  }
  if (lower.endsWith(".py")) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[7px] font-bold bg-[#3572a5] text-white rounded-[2px] ${className}`}
        style={{ width: 14, height: 14 }}
      >
        py
      </span>
    );
  }
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
    return (
      <span
        className={`inline-flex items-center justify-center text-[7px] font-bold bg-[#cb171e] text-white rounded-[2px] ${className}`}
        style={{ width: 14, height: 14 }}
      >
        Y
      </span>
    );
  }
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".webp")
  ) {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="#a074c4">
        <path d="M13 2H3c-.6 0-1 .4-1 1v10c0 .6.4 1 1 1h10c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1zM5 11l2-2 2 2 3-4 2 3H5z" />
      </svg>
    );
  }

  return (
    <svg
      className={`${className} opacity-75`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M9 1H2v14h12V6L9 1zm1 5V2.4l3.6 3.6H10z" />
    </svg>
  );
}
