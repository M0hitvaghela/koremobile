import React from 'react';
interface StatsCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  subtext?: string;
  subtextColor?: 'success' | 'warning' | 'danger' | 'muted';
  pulseDot?: boolean;
}
export function StatsCard({
  label,
  value,
  icon,
  iconBg,
  subtext,
  subtextColor = 'muted',
  pulseDot
}: StatsCardProps) {
  const colors = {
    success: 'text-success',
    warning: 'text-amber-400',
    danger: 'text-red-400',
    muted: 'text-gray-400'
  };
  return (
    <div className="bg-adminSurf border border-adminBorder rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-gray-400 font-medium">{label}</div>
          <div className="font-heading font-extrabold text-2xl text-white mt-1">
            {value}
          </div>
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{
            backgroundColor: iconBg
          }}>
          
          {icon}
        </div>
      </div>
      {subtext &&
      <div
        className={`flex items-center gap-1.5 text-xs ${colors[subtextColor]}`}>
        
          {pulseDot &&
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulseDot" />
        }
          {subtext}
        </div>
      }
    </div>);

}