import React from 'react';
import { PageSkeleton, CardSkeleton, TableRowSkeleton, SectionSkeleton } from './Skeleton';

export const AdminAttendanceSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-9 w-64 bg-slate-700 rounded mb-2" />
          <div className="h-5 w-96 bg-slate-700 rounded" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardSkeleton count={4} />
      </div>

      {/* Tab Navigation */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-slate-700 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-slate-700 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Table Section */}
      <SectionSkeleton>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700">
              <tr>
                {Array.from({ length: 6 }).map((_, i) => (
                  <th key={i} className="py-3 px-6">
                    <div className="h-4 w-24 bg-slate-600 rounded animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              <TableRowSkeleton count={8} columns={6} />
            </tbody>
          </table>
        </div>
      </SectionSkeleton>
    </div>
  );
};

