import React from "react";
import * as Lucide from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: keyof typeof Lucide;
  description: string;
  trendText?: string;
  accentColor?: string;
}

export default function MetricCard({
  title,
  value,
  change,
  isPositive = true,
  icon,
  description,
  trendText,
  accentColor = "blue",
}: MetricCardProps) {
  const IconComponent = Lucide[icon] as React.ComponentType<{ className?: string }>;

  return (
    <div className="relative overflow-hidden bg-white rounded-xl border border-gray-100 p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2.5 rounded-lg bg-gray-50 text-gray-600`}>
          {IconComponent && <IconComponent className="w-5 h-5 text-gray-500" />}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-gray-900">
          {value}
        </span>
        {change && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPositive
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {isPositive ? "↑" : "↓"} {change}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400 truncate">{description}</span>
        {trendText && (
          <span className="text-xs text-gray-400 font-medium">{trendText}</span>
        )}
      </div>

      {/* Subtle bottom underline accent */}
      <div 
        className={`absolute bottom-0 left-0 right-0 h-1 bg-${accentColor}-500 transition-all duration-300`} 
        style={{
          backgroundColor: 
            accentColor === "blue" ? "#3b82f6" : 
            accentColor === "purple" ? "#a855f7" : 
            accentColor === "emerald" ? "#10b981" : 
            accentColor === "orange" ? "#f97316" : "#64748b"
        }}
      />
    </div>
  );
}
