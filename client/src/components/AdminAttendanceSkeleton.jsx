import React from 'react';
import { PageSkeleton, CardSkeleton, TableRowSkeleton, SectionSkeleton } from './Skeleton';

export const AdminAttendanceSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <div className="animate-pulse">
          <div className="h-9 w-64 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 rounded mb-2" />
          <div className="h-5 w-96 bg-zinc-800 rounded" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => {
          const colors = [
            'from-green-600/20 to-emerald-600/20 border-green-500/30',
            'from-yellow-600/20 to-amber-600/20 border-yellow-500/30',
            'from-blue-600/20 to-cyan-600/20 border-blue-500/30',
            'from-zinc-800/20 to-zinc-700/20 border-zinc-700/30'
          ];
          return (
            <div key={i} className={`bg-gradient-to-br ${colors[i]} rounded-lg p-6 border animate-pulse`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="h-3 w-24 bg-zinc-800/50 rounded mb-2" />
                  <div className="h-8 w-20 bg-zinc-700/50 rounded" />
                </div>
                <div className="hidden sm:block mt-2 sm:mt-0">
                  <div className="h-10 w-10 rounded-full bg-zinc-800/50" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab Navigation */}
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-gradient-to-r from-zinc-800/40 to-zinc-700/40 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-zinc-800 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Table Section */}
      <SectionSkeleton>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-gradient-to-r from-zinc-800 to-zinc-700">
              <tr>
                {Array.from({ length: 6 }).map((_, i) => (
                  <th key={i} className="py-3 px-6">
                    <div className="h-4 w-24 bg-zinc-700/70 rounded animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-zinc-900 divide-y divide-zinc-800">
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="py-4 px-6">
                      {j === 0 ? (
                        <div className="h-4 w-32 bg-gradient-to-r from-zinc-800/50 to-zinc-700/50 rounded animate-pulse" />
                      ) : j === 5 ? (
                        <div className="h-6 w-20 bg-gradient-to-r from-yellow-600/30 to-amber-600/30 rounded-full animate-pulse" />
                      ) : (
                        <div className="h-4 w-full max-w-[120px] bg-zinc-800/50 rounded animate-pulse" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionSkeleton>
    </div>
  );
};

