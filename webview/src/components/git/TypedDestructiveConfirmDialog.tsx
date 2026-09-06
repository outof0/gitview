import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { GitDialogShell } from "../ui/GitDialogShell";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";

type TypedDestructiveConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  expectedTypedValue?: string;
  confirmationKey?: string;
  confirmLabel: string;
  testId: string;
  cancelTestId?: string;
  confirmTestId?: string;
  inputTestId?: string;
  busy?: boolean;
  warning?: ReactNode;
  children?: ReactNode;
  onConfirm: (typedValue: string) => void;
  onCancel: () => void;
};

export function TypedDestructiveConfirmDialog({
  open,
  title,
  description,
  expectedTypedValue,
  confirmationKey,
  confirmLabel,
  testId,
  cancelTestId = `${testId}-cancel`,
  confirmTestId = `${testId}-confirm`,
  inputTestId = `${testId}-typed-value`,
  busy = false,
  warning,
  children,
  onConfirm,
  onCancel,
}: TypedDestructiveConfirmDialogProps) {
  const formId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const [typedValue, setTypedValue] = useState("");
  useEffect(() => {
    setTypedValue("");
  }, [confirmationKey, expectedTypedValue]);

  const typedValueMatches =
    expectedTypedValue === undefined || typedValue === expectedTypedValue;
  const canConfirm = typedValueMatches && !busy;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canConfirm) {
      onConfirm(typedValue);
    }
  };

  return (
    <GitDialogShell
      open={open}
      title={title}
      testId={testId}
      onCancel={onCancel}
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-dialog-initial-focus="true"
            data-testid={cancelTestId}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="danger" size="compact" className="disabled:opacity-40 disabled:cursor-default"
            disabled={!canConfirm}
            data-testid={confirmTestId}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} aria-describedby={descriptionId}>
        <p id={descriptionId} className="m-0 mb-3">
          {description}
        </p>
        {children}
        {warning ? (
          <div className="mb-3 text-warning-fg">
            {warning}
          </div>
        ) : null}
        {expectedTypedValue !== undefined ? (
          <label className="block mb-3" htmlFor={inputId}>
            <span className="block mb-1">
              Type <code className="font-mono">{expectedTypedValue}</code> to
              confirm
            </span>
            <TextField
              id={inputId}
              size="default"
              containerClassName="w-full"
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              data-testid={inputTestId}
            />
          </label>
        ) : null}
      </form>
    </GitDialogShell>
  );
}
