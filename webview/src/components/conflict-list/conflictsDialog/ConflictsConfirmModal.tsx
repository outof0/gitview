type ConflictsConfirmModalProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConflictsConfirmModal({
  onCancel,
  onConfirm,
}: ConflictsConfirmModalProps) {
  return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-[20000]">
      <div className="bg-[var(--vscode-editorWidget-background,var(--background))] border border-border rounded-vscode w-[380px] p-4 shadow-2xl flex flex-col gap-3 text-foreground font-sans">
        <div className="font-semibold text-sm">Unresolved Conflicts</div>
        <div className="text-[var(--vscode-descriptionForeground,#70727a)] text-xs leading-relaxed">
          You still have unresolved conflicts. Are you sure you want to
          close? All progress for unresolved files will be reset.
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button
            className="btn-vscode-secondary px-3 py-1.5 text-xs cursor-pointer"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-xs bg-primary hover:bg-primary-hover text-primary-foreground border border-[var(--vscode-button-border,transparent)] rounded-vscode cursor-pointer outline-none font-semibold"
            onClick={onConfirm}
          >
            Yes, Close
          </button>
        </div>
      </div>
    </div>
  );
}