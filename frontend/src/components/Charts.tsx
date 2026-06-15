import type { BitratePoint, CdfPoint } from "../types";

const T = {
  cdfTitle: "CDF 包长分布",
  bitrateTitle: "比特率变化",
  item: "项",
};

type SeriesPoint = { x: number; y: number };

export function LineChart({
  title,
  data,
  xKey,
  yKey,
  color = "#3f6fec",
  suffix = "",
}: {
  title: string;
  data: object[];
  xKey: string;
  yKey: string;
  color?: string;
  suffix?: string;
}) {
  const points = data.map((item) => ({
    x: Number((item as Record<string, unknown>)[xKey]),
    y: Number((item as Record<string, unknown>)[yKey]),
  }));
  const path = buildPath(points);
  const latest = points[points.length - 1]?.y ?? 0;

  return (
    <div className="chart-box">
      <div className="chart-head">
        <span>{title}</span>
        <strong>
          {latest.toFixed(latest > 10 ? 0 : 2)}
          {suffix}
        </strong>
      </div>
      <svg className="line-chart" viewBox="0 0 300 140" role="img" aria-label={title}>
        <Grid />
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function CdfChart({ data }: { data: CdfPoint[] }) {
  const points = data.map((point) => ({ x: point.length, y: point.cdf }));
  return <LineChart title={T.cdfTitle} data={points} xKey="x" yKey="y" color="#16a06c" suffix="" />;
}

export function BitrateChart({ data }: { data: BitratePoint[] }) {
  return <LineChart title={T.bitrateTitle} data={data} xKey="time" yKey="kbps" color="#e86b38" suffix=" Kbps" />;
}

export function MetricBars({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; tone?: "blue" | "green" | "amber" }[];
}) {
  return (
    <div className="chart-box">
      <div className="chart-head">
        <span>{title}</span>
        <strong>
          {items.length} {T.item}
        </strong>
      </div>
      <div className="bars">
        {items.map((item) => (
          <div className="bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="bar-track">
              <i className={item.tone ?? "blue"} style={{ width: `${Math.min(100, item.value)}%` }} />
            </div>
            <b>{item.value.toFixed(1)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Grid() {
  return (
    <>
      {[30, 70, 110].map((y) => (
        <line key={y} x1="18" x2="286" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {[70, 130, 190, 250].map((x) => (
        <line key={x} x1={x} x2={x} y1="18" y2="124" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
    </>
  );
}

function buildPath(points: SeriesPoint[]): string {
  if (points.length === 0) return "";
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scaleX = (value: number) => 18 + ((value - minX) / Math.max(1, maxX - minX)) * 268;
  const scaleY = (value: number) => 124 - ((value - minY) / Math.max(1, maxY - minY)) * 106;

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x).toFixed(1)} ${scaleY(point.y).toFixed(1)}`)
    .join(" ");
}

