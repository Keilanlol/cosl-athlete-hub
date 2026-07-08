import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  PAGE_SIZE,
  PagerBar,
  SortBtn,
  TableSkeleton,
} from "@/components/DataTableShell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// useTableSort — tri générique pour les pages liste
// ─────────────────────────────────────────────────────────────────────────────

export function useTableSort<T, K extends string>(
  defaultKey: K,
  rows: T[] | null,
  searchFn: (row: T, q: string) => boolean,
  filterFns: Array<(row: T) => boolean> = [],
) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: K; dir: "asc" | "desc" }>({
    key: defaultKey,
    dir: "asc",
  });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = rows.slice();
    for (const fn of filterFns) {
      r = r.filter(fn);
    }
    if (q) r = r.filter((row) => searchFn(row, q));
    r.sort((a, b) => {
      const av = ((a as Record<string, unknown>)[sort.key] ?? "").toString().toLowerCase();
      const bv = ((b as Record<string, unknown>)[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, sort, filterFns]);

  useEffect(() => {
    setPage(1);
  }, [search, sort.key]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const toggleSort = (key: K) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  return {
    search,
    setSearch,
    sort,
    toggleSort,
    page,
    setPage,
    pageCount,
    filtered,
    visible,
    filteredCount: filtered.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ListPageHeader — header unifié avec icône, titre, description, actions
// ─────────────────────────────────────────────────────────────────────────────

export function ListPageHeader({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchInput — input de recherche unifié
// ─────────────────────────────────────────────────────────────────────────────

export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative max-w-sm flex-1 min-w-[220px] ${className}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ResultCount — compteur de résultats unifié
// ─────────────────────────────────────────────────────────────────────────────

export function ResultCount({
  count,
  total,
  loading = false,
}: {
  count: number;
  total?: number;
  loading?: boolean;
}) {
  return (
    <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">
      {loading
        ? "Chargement…"
        : total !== undefined && total > count
          ? `${count} résultat(s) sur ${total}`
          : `${count} résultat(s)`}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DataTable — wrapper unifié du tableau avec skeleton, empty state, pager
// ─────────────────────────────────────────────────────────────────────────────

export function DataTable({
  loading,
  isEmpty,
  skeletonCols,
  emptyMessage,
  columnCount,
  children,
  page,
  pageCount,
  onPageChange,
}: {
  loading: boolean;
  isEmpty: boolean;
  skeletonCols: number;
  emptyMessage: string;
  columnCount: number;
  children: ReactNode;
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <>
      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <TableSkeleton cols={skeletonCols} />
        ) : isEmpty ? (
          <div className="p-6">
            <EmptyState message={emptyMessage} />
          </div>
        ) : (
          children
        )}
      </div>
      <PagerBar page={page} pageCount={pageCount} onChange={onPageChange} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SortableHeader — cellule d'en-tête triable
// ─────────────────────────────────────────────────────────────────────────────

export function SortableHeader<K extends string>({
  sortKey,
  sort,
  onToggle,
  children,
  className,
}: {
  sortKey: K;
  sort: { key: K; dir: "asc" | "desc" };
  onToggle: (key: K) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <SortBtn active={sort.key === sortKey} dir={sort.dir} onClick={() => onToggle(sortKey)}>
        {children}
      </SortBtn>
    </TableHead>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PhotoCell — cellule photo/avatar unifiée
// ─────────────────────────────────────────────────────────────────────────────

export function PhotoCell({
  photoUrl,
  initials,
  className = "",
}: {
  photoUrl: string | null | undefined;
  initials: string;
  className?: string;
}) {
  return (
    <TableCell className={className}>
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">
            {initials || "—"}
          </span>
        )}
      </div>
    </TableCell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionsCell — cellule actions (modifier, supprimer)
// ─────────────────────────────────────────────────────────────────────────────

export function ActionsCell({
  onEdit,
  onDelete,
  editLabel = "Modifier",
  deleteLabel = "Supprimer",
  canDelete = true,
}: {
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
  canDelete?: boolean;
}) {
  return (
    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label={editLabel}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {onDelete && canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600 hover:text-red-700"
          onClick={onDelete}
          aria-label={deleteLabel}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </TableCell>
  );
}

// Import needed inside ActionsCell
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";