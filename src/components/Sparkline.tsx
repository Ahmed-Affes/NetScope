import React from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 240,
  height = 40,
  color = "#38bdf8",
  fillColor = "rgba(56, 189, 248, 0.15)",
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-[10px] text-slate-500 bg-white/[0.02] rounded border border-white/[0.04]"
      >
        No activity recorded
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1 || 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const fillD = `M 0,${height} L ${points.join(" L ")} L ${width},${height} Z`;

  return (
    <div className="relative overflow-hidden rounded bg-[#07090d]/80 border border-white/[0.05] p-1">
      <svg width={width} height={height} className="overflow-visible">
        {/* Gradient Fill */}
        <path d={fillD} fill={fillColor} />
        {/* Stroke Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Peak indicator dot */}
        {data.length > 0 && (
          <circle
            cx={points[points.length - 1].split(",")[0]}
            cy={points[points.length - 1].split(",")[1]}
            r="2.5"
            fill="#ffffff"
            stroke={color}
            strokeWidth="1"
          />
        )}
      </svg>
    </div>
  );
};
