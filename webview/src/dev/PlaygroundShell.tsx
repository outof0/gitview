import { App } from "../App";
import { GitHistoryApp } from "../GitHistoryApp";
import { DevToolbar } from "./DevToolbar";
import type { MockHost } from "./mockHost";

type PlaygroundShellProps = {
  host: MockHost;
  app?: "merge" | "gitHistory";
};

export function PlaygroundShell({
  host,
  app = "merge",
}: PlaygroundShellProps) {
  const Root = app === "gitHistory" ? GitHistoryApp : App;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <DevToolbar host={host} />
      <div className="min-h-0 flex-1">
        <Root />
      </div>
    </div>
  );
}