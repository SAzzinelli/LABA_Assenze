import React from 'react';

// Skeleton base con animazione
const SkeletonBase = ({ className = '', ...props }) => (
  <div
    className={`animate-pulse bg-zinc-800 rounded ${className}`}
    {...props}
  />
);

// Skeleton per card KPI
export const CardSkeleton = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-zinc-900 rounded-lg p-3 sm:p-6">
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
        <tr key={i} className="border-b border-zinc-800">
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
        <div key={i} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
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
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
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
    <div className="min-h-screen bg-black text-white p-6">
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
      <div className="bg-zinc-900 rounded-lg p-6">
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
      <div className="bg-zinc-900 rounded-lg p-6">
        <SkeletonBase className="h-9 w-48 mb-2" />
        <SkeletonBase className="h-5 w-96" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CardSkeleton count={2} />
      </div>

      {/* Tab Navigation */}
      <div className="bg-zinc-900 rounded-lg p-4">
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
        <div className="bg-zinc-900 rounded-lg p-6">
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

// Skeleton per pagina Ferie
export const FerieSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <SkeletonBase className="h-9 w-48 mb-2" />
            <SkeletonBase className="h-5 w-96" />
          </div>
        </div>
      </div>

      {/* KPI Cards - 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardSkeleton count={4} />
      </div>

      {/* Filtri Collassabili */}
      <div className="bg-zinc-900 rounded-lg overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <SkeletonBase className="h-5 w-32" />
          <SkeletonBase className="h-5 w-5 rounded" />
        </div>
      </div>

      {/* Vista Lista/Calendario Toggle */}
      <div className="bg-zinc-900 rounded-lg p-4">
        <div className="flex gap-2">
          <SkeletonBase className="h-10 w-32 rounded-lg" />
          <SkeletonBase className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Lista Richieste */}
      <div className="bg-zinc-900 rounded-lg p-4">
        <SkeletonBase className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          <ListCardSkeleton count={4} />
        </div>
      </div>
    </div>
  );
};

// Skeleton per pagina Permessi
export const PermessiSkeleton = () => {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Mobile */}
      <div className="lg:hidden bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <SkeletonBase className="h-6 w-32" />
          <SkeletonBase className="h-10 w-10 rounded-lg" />
        </div>
        <div className="flex bg-zinc-800 rounded-lg p-1">
          <SkeletonBase className="h-10 flex-1 rounded-md" />
          <SkeletonBase className="h-10 flex-1 rounded-md" />
        </div>
      </div>

      {/* Header Desktop */}
      <div className="hidden lg:block bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <SkeletonBase className="h-9 w-64 mb-2" />
            <SkeletonBase className="h-5 w-96" />
          </div>
          <div className="flex gap-4">
            <div className="flex bg-zinc-800 rounded-lg p-1">
              <SkeletonBase className="h-10 w-32 rounded-md" />
              <SkeletonBase className="h-10 w-32 rounded-md" />
            </div>
            <SkeletonBase className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Filtri Collassabili */}
      <div className="bg-zinc-900 rounded-lg overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <SkeletonBase className="h-5 w-32" />
          <SkeletonBase className="h-5 w-5 rounded" />
        </div>
      </div>

      {/* Lista Richieste - Card Permessi */}
      <div className="bg-zinc-900 rounded-lg p-4">
        <SkeletonBase className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg p-3 bg-zinc-800/80 border border-zinc-700/50 border-l-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <SkeletonBase className="h-5 w-5 rounded-full" />
                  <div>
                    <SkeletonBase className="h-4 w-32 mb-1" />
                    <SkeletonBase className="h-5 w-20 rounded-full" />
                  </div>
                </div>
                <SkeletonBase className="h-12 w-24 rounded-lg" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <SkeletonBase className="h-3 w-24 mb-2" />
                  <SkeletonBase className="h-5 w-32" />
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <SkeletonBase className="h-3 w-20 mb-2" />
                  <SkeletonBase className="h-5 w-24" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <SkeletonBase className="h-3 w-28 mb-1" />
                  <SkeletonBase className="h-3 w-40" />
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <SkeletonBase className="h-3 w-24 mb-1" />
                  <SkeletonBase className="h-3 w-36" />
                </div>
              </div>
              <div className="flex gap-1.5 pt-2 border-t border-zinc-700/50">
                <SkeletonBase className="h-9 w-24 rounded-lg" />
                <SkeletonBase className="h-9 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Skeleton per pagina Permessi 104
export const Permessi104Skeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <SkeletonBase className="h-9 w-48 mb-2" />
            <SkeletonBase className="h-5 w-96" />
          </div>
          <SkeletonBase className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* KPI Card - Saldo 104 */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBase className="h-5 w-40" />
          <SkeletonBase className="h-6 w-6 rounded-full" />
        </div>
        <SkeletonBase className="h-12 w-32 mb-2" />
        <SkeletonBase className="h-4 w-48" />
      </div>

      {/* Filtri */}
      <div className="bg-zinc-900 rounded-lg overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <SkeletonBase className="h-5 w-32" />
          <SkeletonBase className="h-5 w-5 rounded" />
        </div>
      </div>

      {/* Lista Richieste */}
      <div className="bg-zinc-900 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBase className="h-6 w-48" />
          <SkeletonBase className="h-4 w-24" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <SkeletonBase className="h-5 w-5 rounded" />
                    <SkeletonBase className="h-5 w-48" />
                    <SkeletonBase className="h-6 w-20 rounded-full" />
                  </div>
                  <SkeletonBase className="h-4 w-64 ml-8 mb-1" />
                  <SkeletonBase className="h-3 w-48 ml-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Skeleton per Dashboard Dipendente
export const DashboardEmployeeSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-lg p-6">
        <SkeletonBase className="h-9 w-48 mb-2" />
        <SkeletonBase className="h-5 w-96" />
      </div>

      {/* KPI Cards - 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <CardSkeleton count={3} />
      </div>

      {/* Grid 2 colonne: Banca Ore/Ferie e Eventi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Banca Ore */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <SkeletonBase className="h-6 w-32" />
            <SkeletonBase className="h-5 w-5 rounded" />
          </div>
          <SkeletonBase className="h-12 w-40 mb-2" />
          <SkeletonBase className="h-4 w-48" />
        </div>

        {/* Ferie */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <SkeletonBase className="h-6 w-24" />
            <SkeletonBase className="h-5 w-5 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SkeletonBase className="h-3 w-24 mb-1" />
              <SkeletonBase className="h-8 w-16" />
            </div>
            <div>
              <SkeletonBase className="h-3 w-24 mb-1" />
              <SkeletonBase className="h-8 w-16" />
            </div>
          </div>
        </div>

        {/* Eventi Imminenti */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <SkeletonBase className="h-6 w-40" />
            <SkeletonBase className="h-5 w-5 rounded" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <SkeletonBase className="h-4 w-32 mb-1" />
                    <SkeletonBase className="h-3 w-40" />
                  </div>
                  <SkeletonBase className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Skeleton per Dashboard Admin
export const DashboardAdminSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <SkeletonBase className="h-9 w-48 mb-2" />
        <SkeletonBase className="h-5 w-96" />
      </div>

      {/* Sezione In Malattia Oggi */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBase className="h-6 w-40" />
          <SkeletonBase className="h-5 w-5 rounded" />
        </div>
        <div className="space-y-3">
          <ListCardSkeleton count={2} />
        </div>
      </div>

      {/* Recuperi Imminenti */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBase className="h-6 w-48" />
          <SkeletonBase className="h-4 w-32" />
        </div>
        <ListCardSkeleton count={2} />
      </div>

      {/* Presenti adesso */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <SkeletonBase className="h-6 w-40" />
          <SkeletonBase className="h-5 w-5 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ListCardSkeleton count={4} />
        </div>
      </div>

      {/* Grid Richieste Recenti e In programma oggi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Richieste Recenti */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <SkeletonBase className="h-6 w-40" />
            <SkeletonBase className="h-5 w-5 rounded" />
          </div>
          <ListCardSkeleton count={3} />
        </div>

        {/* In programma oggi */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <SkeletonBase className="h-6 w-40" />
            <SkeletonBase className="h-5 w-5 rounded" />
          </div>
          <ListCardSkeleton count={2} />
        </div>
      </div>
    </div>
  );
};

export default SkeletonBase;

