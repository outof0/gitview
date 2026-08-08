export function ChevronRightIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 4l4 4-4 4z" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 6l4 4 4-4z" />
    </svg>
  );
}

export function FolderIcon({
  className = "w-4 h-4 text-foreground/75",
}: {
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.5 3H8.2L6.7 1.5H1.5c-.8 0-1.5.7-1.5 1.5v10c0 .8.7 1.5 1.5 1.5h13c.8 0 1.5-.7 1.5-1.5V4.5c0-.8-.7-1.5-1.5-1.5zM15 13c0 .3-.2.5-.5.5h-13c-.3 0-.5-.2-.5-.5V4h14v9z" />
    </svg>
  );
}

export function FileIcon({
  className = "w-4 h-4 text-foreground/75",
}: {
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M9 1H2v14h12V6L9 1zm1 5V2.4l3.6 3.6H10zM3 14V2h6v5h5v7H3z" />
    </svg>
  );
}