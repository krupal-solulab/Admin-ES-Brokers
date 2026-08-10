import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  align?: "left" | "right";
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  defaultSort,
  emptyState,
}: {
  columns: Column<T>[];
  rows: T[];
  defaultSort?: { id: string; desc?: boolean };
  emptyState: ReactNode;
}) {
  const [sort, setSort] = useState<{ id: string; desc: boolean } | null>(
    defaultSort ? { id: defaultSort.id, desc: Boolean(defaultSort.desc) } : null,
  );

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.id === sort.id);
    if (!column?.sortValue) return rows;
    const next = [...rows].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (left === right) return 0;
      return left > right ? 1 : -1;
    });
    return sort.desc ? next.reverse() : next;
  }, [rows, sort, columns]);

  if (rows.length === 0) {
    return <div className="panel px-6 py-12">{emptyState}</div>;
  }

  return (
    <div className="panel overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface/60">
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue);
              const active = sort?.id === column.id;
              return (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    "label-caps px-4 py-3 text-left",
                    column.align === "right" && "text-right",
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((current) =>
                          current?.id === column.id
                            ? { id: column.id, desc: !current.desc }
                            : { id: column.id, desc: false },
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                        active && "text-foreground",
                        column.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {column.header}
                      {active ? (
                        sort?.desc ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUp className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border/60 last:border-0 transition-colors hover:bg-surface/50"
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    "px-4 py-3 align-middle",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
