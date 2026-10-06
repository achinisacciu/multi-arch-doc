import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  colorClass: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass,
}) => {
  return (
    <div className="glass-panel p-5 rounded-2xl flex items-start gap-4 shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300">
      <div className={`p-3 rounded-xl ${colorClass} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-display font-semibold text-gray-900 mt-1 truncate">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
      </div>
    </div>
  );
};
