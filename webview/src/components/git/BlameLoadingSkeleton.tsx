export function BlameLoadingSkeleton({ rows = 14 }: { rows?: number }) {
  return (
    <div
      className="flex-1 min-h-0 overflow-hidden bg-vscode-editor-bg"
      data-testid="blame-loading-skeleton"
      aria-busy
      aria-label="Loading blame annotations"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center min-h-[22px]">
          <div className="shrink-0 w-[clamp(260px,25vw,520px)] min-w-[260px] flex items-center gap-2 px-2.5 border-r border-vscode-panel-border">
            {i % 4 === 0 && (
              <div className="w-0.5 h-3.5 rounded-sm bg-vscode-panel-border animate-blame-pulse" />
            )}
            {i % 4 === 0 && (
              <div className="flex-1 h-2.5 rounded-sm bg-vscode-panel-border opacity-50 animate-blame-pulse" />
            )}
          </div>
          <div className="w-12 h-2.5 mr-3 rounded-sm bg-vscode-panel-border opacity-35 animate-blame-pulse" />
          <div
            className="h-2.5 rounded-sm bg-vscode-panel-border opacity-40 animate-blame-pulse"
            style={{ width: `${40 + (i % 5) * 12}%` }}
          />
        </div>
      ))}
    </div>
  );
}