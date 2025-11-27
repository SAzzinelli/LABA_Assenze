import React from 'react';

// Skeleton base con animazione
const SkeletonBase = ({ className = '', ...props }) => (
  <div
    className={`animate-pulse bg-slate-700 rounded ${className}`}
    {...props}
  />
);

// Skeleton per card KPI
export const CardSkeleton = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-slate-800 rounded-lg p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <SkeletonBase className="h-3 w-24 mb-2" />
              <SkeletonBase className="h-8 w-20" />
            </div>
            <div className="hidden sm:block">
              <SkeletonBase className="h-10 w-10 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

// Skeleton per righe di tabella
export const TableRowSkeleton = ({ count = 5, columns = 5 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-slate-700">
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="py-4 px-6">
              <SkeletonBase className="h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

// Skeleton per card lista
export const ListCardSkeleton = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <SkeletonBase className="h-10 w-10 rounded-full" />
              <div>
                <SkeletonBase className="h-4 w-32 mb-2" />
                <SkeletonBase className="h-3 w-24" />
              </div>
            </div>
            <SkeletonBase className="h-6 w-16 rounded-full" />
          </div>
          <div className="space-y-2">
            <SkeletonBase className="h-3 w-full" />
            <SkeletonBase className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </>
  );
};

// Skeleton per sezione con header
export const SectionSkeleton = ({ showHeader = true, children }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      {showHeader && (
        <div className="mb-6">
          <SkeletonBase className="h-6 w-48 mb-2" />
          <SkeletonBase className="h-4 w-64" />
        </div>
      )}
      {children}
    </div>
  );
};

// Skeleton per pagina Presenze
export const PresenzeSkeleton = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <SkeletonBase className="h-9 w-48 mb-2" />
          <SkeletonBase className="h-5 w-80" />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <CardSkeleton count={4} />
        </div>

        {/* Stato Oggi */}
        <SectionSkeleton>
          <div className="space-y-4">
            <SkeletonBase className="h-6 w-32" />
            <div className="grid grid-cols-2 gap-4">
              <SkeletonBase className="h-20 w-full" />
              <SkeletonBase className="h-20 w-full" />
            </div>
          </div>
        </SectionSkeleton>

        {/* Cronologia */}
        <div className="mt-6">
          <SectionSkeleton>
            <div className="space-y-3">
              <SkeletonBase className="h-6 w-40 mb-4" />
              <TableRowSkeleton count={5} columns={6} />
            </div>
          </SectionSkeleton>
        </div>
      </div>
    </div>
  );
};

// Skeleton per pagina Banca Ore
export const BancaOreSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <SkeletonBase className="h-9 w-48 mb-2" />
        <SkeletonBase className="h-5 w-96" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CardSkeleton count={3} />
      </div>

      {/* Sezione Debito/Credito */}
      <SectionSkeleton>
        <div className="space-y-4">
          <SkeletonBase className="h-6 w-40" />
          <ListCardSkeleton count={3} />
        </div>
      </SectionSkeleton>

      {/* Fluttuazioni */}
      <SectionSkeleton>
        <div className="space-y-4">
          <SkeletonBase className="h-6 w-40" />
          <TableRowSkeleton count={5} columns={4} />
        </div>
      </SectionSkeleton>
    </div>
  );
};

// Skeleton per pagina Recuperi Ore
export const RecuperiOreSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <SkeletonBase className="h-9 w-48 mb-2" />
        <SkeletonBase className="h-5 w-96" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CardSkeleton count={2} />
      </div>

      {/* Tab Navigation */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="flex gap-2">
          <SkeletonBase className="h-10 w-32 rounded-lg" />
          <SkeletonBase className="h-10 w-32 rounded-lg" />
          <SkeletonBase className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Content */}
      <SectionSkeleton>
        <ListCardSkeleton count={4} />
      </SectionSkeleton>
    </div>
  );
};

// Skeleton generico per pagine
export const PageSkeleton = ({ showHeader = true, showCards = true, showTable = true }) => {
  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="bg-slate-800 rounded-lg p-6">
          <SkeletonBase className="h-9 w-48 mb-2" />
          <SkeletonBase className="h-5 w-96" />
        </div>
      )}

      {showCards && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardSkeleton count={3} />
        </div>
      )}

      {showTable && (
        <SectionSkeleton>
          <TableRowSkeleton count={5} columns={5} />
        </SectionSkeleton>
      )}
    </div>
  );
};

export default SkeletonBase;

