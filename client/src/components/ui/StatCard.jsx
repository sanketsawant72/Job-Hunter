import React from 'react';

const StatCard = ({ title, value, icon: Icon, color = 'primary', trend, subtitle }) => {
  const colors = {
    primary: { text: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
    green:   { text: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-900/20' },
    blue:    { text: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
    purple:  { text: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20' },
    orange:  { text: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-900/20' },
    red:     { text: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20' }
  };
  const { text: textColor, bg: bgColor } = colors[color] || colors.primary;

  return (
    <div className="card p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            {value ?? <span className="skeleton w-16 h-8 block" />}
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <span className={`inline-flex items-center text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} this week
            </span>
          )}
        </div>
        <div className={`p-3 rounded-xl ${bgColor}`}>
          <Icon className={`w-6 h-6 ${textColor}`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
