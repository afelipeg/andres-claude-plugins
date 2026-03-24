'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface TableData {
  headers: string[];
  rows: unknown[][];
  sortable?: boolean;
}

interface TableArtifactProps {
  data: TableData;
  options?: Record<string, unknown>;
}

type SortDirection = 'asc' | 'desc' | null;

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(2);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const SortIcon = ({ direction }: { direction: SortDirection }) => (
  <span className="inline-flex flex-col ml-1 text-[8px] leading-none">
    <span className={direction === 'asc' ? 'text-zinc-200' : 'text-zinc-600'}>&#9650;</span>
    <span className={direction === 'desc' ? 'text-zinc-200' : 'text-zinc-600'}>&#9660;</span>
  </span>
);

export function TableArtifact({ data }: TableArtifactProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const sortable = data?.sortable !== false;

  const handleSort = useCallback(
    (colIndex: number) => {
      if (!sortable) return;
      if (sortCol === colIndex) {
        if (sortDir === 'asc') setSortDir('desc');
        else if (sortDir === 'desc') {
          setSortCol(null);
          setSortDir(null);
        } else {
          setSortDir('asc');
        }
      } else {
        setSortCol(colIndex);
        setSortDir('asc');
      }
    },
    [sortCol, sortDir, sortable],
  );

  const sortedRows = useMemo(() => {
    if (!data?.rows?.length) return [];
    if (sortCol === null || sortDir === null) return data.rows;

    return [...data.rows].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data?.rows, sortCol, sortDir]);

  if (!data?.headers?.length || !data?.rows?.length) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
        No table data available
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            {data.headers.map((header, i) => (
              <th
                key={i}
                className={cn(
                  'px-3 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap',
                  sortable && 'cursor-pointer hover:text-zinc-200 select-none transition-colors',
                )}
                onClick={() => handleSort(i)}
              >
                <span className="inline-flex items-center">
                  {header}
                  {sortable && <SortIcon direction={sortCol === i ? sortDir : null} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className={cn(
                    'px-3 py-2 text-zinc-300 whitespace-nowrap',
                    typeof cell === 'number' && 'tabular-nums text-right',
                  )}
                >
                  {formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-zinc-600 mt-2 px-3">
        {sortedRows.length} row{sortedRows.length !== 1 ? 's' : ''}
        {sortable && ' - Click headers to sort'}
      </p>
    </div>
  );
}
