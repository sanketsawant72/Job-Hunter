import React from 'react';

const SkeletonRow = ({ cols = 5 }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full max-w-[120px]" />
      </td>
    ))}
  </tr>
);

export const SkeletonCard = () => (
  <div className="card p-5 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
      </div>
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  </div>
);

export default SkeletonRow;
