import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  pageSize = 24,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [24, 48, 96],
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate range of page numbers around current page
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-slate-200/80 text-xs">
      {/* Left: Item range summary */}
      <div className="text-slate-500 font-medium">
        Showing <strong className="text-slate-900 font-bold">{startItem}–{endItem}</strong> of{' '}
        <strong className="text-slate-900 font-bold">{totalItems.toLocaleString()}</strong> photos
      </div>

      {/* Right: Page size selector + Pagination buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center space-x-1.5 text-slate-500">
            <span className="shrink-0 font-medium">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-600 cursor-pointer shadow-xs"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
              <option value={999999}>All</option>
            </select>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center space-x-1">
            {/* Previous Page */}
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page 1 jump if far back */}
            {pageNumbers[0] > 1 && (
              <>
                <button
                  onClick={() => onPageChange(1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
                >
                  1
                </button>
                {pageNumbers[0] > 2 && <span className="px-1 text-slate-400">…</span>}
              </>
            )}

            {/* Middle Page numbers */}
            {pageNumbers.map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-xs ${
                  currentPage === p
                    ? 'bg-indigo-600 text-white border border-indigo-600 shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}

            {/* Last Page jump if far ahead */}
            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-slate-400">…</span>
                )}
                <button
                  onClick={() => onPageChange(totalPages)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
                >
                  {totalPages}
                </button>
              </>
            )}

            {/* Next Page */}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
