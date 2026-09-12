import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type Ref,
} from "react";
import {
  GIT_LOG_GRAPH_DOT_RADIUS,
  GIT_LOG_GRAPH_ROW_HEIGHT,
  buildGraphCanvasPrimitives,
  hitTestGraphPrimitives,
  type GitLogGraphLayout,
  type GraphHit,
} from "../../lib/gitLogGraph";

export type GitLogGraphOverlayHandle = {
  /** Paint rows [startRow, endRow) synchronously (content coordinates). */
  paint: (startRow: number, endRow: number) => void;
  getPaintedRows: () => { start: number; end: number };
  /** Content coordinates; returns every underlying edge in a shared terminal. */
  hitTest: (x: number, y: number) => GraphHit | null;
};

const LANE_COLOR_VARS = [
  "--gitview-graph-purple",
  "--gitview-graph-green",
  "--gitview-graph-pink",
  "--gitview-graph-blue",
  "--gitview-graph-cyan",
  "--gitview-graph-orange",
  "--gitview-graph-yellow",
] as const;

function resolveLaneColors(): string[] {
  const styles = getComputedStyle(document.documentElement);
  const fallback = styles.getPropertyValue("--foreground").trim() || "transparent";
  return LANE_COLOR_VARS.map(
    (name) => styles.getPropertyValue(name).trim() || fallback,
  );
}

function resolveGraphBackground(): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim() || "transparent"
  );
}

type GitLogGraphOverlayProps = {
  layout: GitLogGraphLayout;
  rowCount: number;
  /** Fixed gutter width; messages start after it, so it never shifts. */
  gutterWidth: number;
  panX: number;
  handleRef: Ref<GitLogGraphOverlayHandle>;
};

/**
 * Canvas commit graph, painted in content coordinates for the rows the list
 * asks for. The list keeps the painted window covering the viewport and
 * repaints synchronously on a coverage miss, so fast scroll never exposes a
 * blank gutter.
 */
export function GitLogGraphOverlay({
  layout,
  rowCount,
  gutterWidth,
  panX,
  handleRef,
}: GitLogGraphOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintedRef = useRef({
    start: 0,
    end: Math.min(rowCount, 64),
  });
  const colorsRef = useRef<string[] | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    // jsdom has no 2d context; the DOM mirrors stay testable without pixels.
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const { start, end } = paintedRef.current;
    // Clamp to visible rows, not to the commit count: collapsed placeholders
    // occupy rows, and the last commits must still be painted.
    const clampedEnd = Math.min(end, rowCount);
    if (clampedEnd <= start) {
      return;
    }
    const height = (clampedEnd - start) * GIT_LOG_GRAPH_ROW_HEIGHT;
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(gutterWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }
    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }
    canvas.style.width = `${gutterWidth}px`;
    canvas.style.height = `${height}px`;
    canvas.style.top = `${start * GIT_LOG_GRAPH_ROW_HEIGHT}px`;

    const colors = colorsRef.current ?? resolveLaneColors();
    colorsRef.current = colors;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, gutterWidth, height);

    const { lines, arrows, dots } = buildGraphCanvasPrimitives(
      layout,
      start,
      clampedEnd,
    );
    const baseY = start * GIT_LOG_GRAPH_ROW_HEIGHT;
    const colorFor = (lane: number) => colors[lane % colors.length]!;

    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalAlpha = 0.9;
    for (let lane = 0; lane < colors.length; lane += 1) {
      let started = false;
      for (const line of lines) {
        if (line.lane % colors.length !== lane) {
          continue;
        }
        if (!started) {
          context.beginPath();
          started = true;
        }
        context.moveTo(line.x1 - panX, line.y1 - baseY);
        context.lineTo(line.x2 - panX, line.y2 - baseY);
      }
      if (started) {
        context.strokeStyle = colors[lane]!;
        context.stroke();
      }
    }

    for (const arrow of arrows) {
      const x = arrow.x - panX;
      const y = arrow.y - baseY;
      const direction = arrow.direction === "down" ? 1 : -1;
      const tip = y + direction * (GIT_LOG_GRAPH_ROW_HEIGHT * 0.45);
      context.strokeStyle = colorFor(arrow.lane);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, tip);
      context.moveTo(x, tip);
      context.lineTo(x - 4, tip - direction * 6);
      context.moveTo(x, tip);
      context.lineTo(x + 4, tip - direction * 6);
      context.stroke();
    }

    context.globalAlpha = 1;
    for (const dot of dots) {
      const x = dot.x - panX;
      const y = dot.y - baseY;
      if (x < -GIT_LOG_GRAPH_DOT_RADIUS || x > gutterWidth + GIT_LOG_GRAPH_DOT_RADIUS) {
        continue;
      }
      context.beginPath();
      context.arc(x, y, GIT_LOG_GRAPH_DOT_RADIUS, 0, Math.PI * 2);
      context.fillStyle = colorFor(dot.lane);
      context.fill();
      context.strokeStyle = resolveGraphBackground();
      context.lineWidth = 2;
      context.stroke();
      if (dot.isMerge) {
        context.beginPath();
        context.arc(x, y, GIT_LOG_GRAPH_DOT_RADIUS + 2.5, 0, Math.PI * 2);
        context.strokeStyle = colorFor(dot.lane);
        context.lineWidth = 1.4;
        context.stroke();
      }
    }
  }, [gutterWidth, layout, panX, rowCount]);

  useImperativeHandle(
    handleRef,
    () => ({
      paint: (startRow: number, endRow: number) => {
        paintedRef.current = { start: startRow, end: endRow };
        draw();
      },
      getPaintedRows: () => ({ ...paintedRef.current }),
      hitTest: (x: number, y: number) => {
        const { start, end } = paintedRef.current;
        return hitTestGraphPrimitives(
          buildGraphCanvasPrimitives(layout, start, Math.min(end, rowCount)),
          x,
          y,
        );
      },
    }),
    [draw, layout, rowCount],
  );

  const drawRef = useRef(draw);
  drawRef.current = draw;

  useLayoutEffect(() => {
    const root = rootRef.current;
    root?.setAttribute("width", String(gutterWidth));
    root?.setAttribute("height", String(layout.height));
    draw();
  }, [draw, gutterWidth, layout.height]);

  // Theme switches replace the CSS custom properties without changing props.
  useEffect(() => {
    const invalidate = () => {
      colorsRef.current = null;
      // Repaint with the new theme tokens instead of waiting for the next
      // scroll or prop change.
      drawRef.current();
    };
    const observer = new MutationObserver(invalidate);
    observer.observe(document.documentElement, { attributes: true });
    observer.observe(document.body, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className="absolute left-0 top-0 pointer-events-none overflow-hidden"
      style={{ width: gutterWidth, height: layout.height }}
      aria-hidden="true"
      data-testid="git-log-graph"
    >
      <canvas
        ref={canvasRef}
        className="absolute left-0"
        data-testid="git-log-graph-canvas"
      />
    </div>
  );
}
