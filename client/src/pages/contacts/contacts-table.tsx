import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useContactMutations } from "@/hooks/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnOrderState,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Columns, Search, User } from "lucide-react";
import type { ContactWithStats } from "@/lib/api/contacts";
import {
  CONTACTS_DEFAULT_COLUMN_ORDER,
  createContactsColumns,
  getContactsColumnsMeta,
} from "./contacts-columns";
import { ContactsColumnsDialog } from "./contacts-columns-dialog";
import { NewContactDialog } from "./new-contact-dialog";

const COLUMN_VISIBILITY_KEY = "contacts-column-visibility";
const COLUMN_ORDER_KEY = "contacts-column-order";
const COLUMN_SIZING_KEY = "contacts-column-sizing";

function safeLoadJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeColumnOrder(order: string[]): ColumnOrderState {
  const allowed = new Set(CONTACTS_DEFAULT_COLUMN_ORDER);
  const deduped = Array.from(new Set(order)).filter((id) => allowed.has(id as any));
  const merged = [
    ...deduped.filter((id) => id !== "actions"),
    ...CONTACTS_DEFAULT_COLUMN_ORDER.filter((id) => id !== "actions" && !deduped.includes(id)),
    "actions",
  ];
  return merged;
}

export function ContactsTable({
  contacts,
  isLoading,
  onSelectContact,
}: {
  contacts: ContactWithStats[];
  isLoading: boolean;
  onSelectContact: (contact: ContactWithStats) => void;
}) {
  const { t, language } = useTranslation();
  const { deleteContact } = useContactMutations();
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const saved = safeLoadJson<VisibilityState>(COLUMN_VISIBILITY_KEY);
    return saved || {};
  });

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    const saved = safeLoadJson<string[]>(COLUMN_ORDER_KEY);
    return saved ? normalizeColumnOrder(saved) : [...CONTACTS_DEFAULT_COLUMN_ORDER];
  });

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    const saved = safeLoadJson<ColumnSizingState>(COLUMN_SIZING_KEY);
    return saved || {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
    } catch {
      // ignore
    }
  }, [columnVisibility]);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
    } catch {
      // ignore
    }
  }, [columnOrder]);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_SIZING_KEY, JSON.stringify(columnSizing));
    } catch {
      // ignore
    }
  }, [columnSizing]);

  const columnsMeta = useMemo(() => getContactsColumnsMeta(t), [t]);
  const columnLabelById = useMemo(() => {
    return Object.fromEntries(columnsMeta.map((col) => [col.id, col.label]));
  }, [columnsMeta]);

  const handleDeleteContact = (contact: ContactWithStats) => {
    const name = `${contact.firstName} ${contact.lastName || ""}`.trim();
    if (window.confirm(t("contacts.deleteConfirm", { name }))) {
      deleteContact.mutate(contact.id);
    }
  };

  const columns = useMemo(
    () =>
      createContactsColumns({
        t,
        language,
        onViewDetails: onSelectContact,
        onDeleteContact: handleDeleteContact,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, language, onSelectContact],
  );

  const table = useReactTable({
    data: contacts,
    columns,
    enableColumnResizing: true,
    state: {
      sorting,
      columnVisibility,
      columnOrder,
      columnSizing,
      globalFilter: searchQuery,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onGlobalFilterChange: setSearchQuery,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
  });

  const orderedColumnIds = useMemo(() => {
    return columnOrder.filter((id) => id !== "actions" && !!table.getColumn(id));
  }, [columnOrder, table]);

  const handleResetColumns = () => {
    setColumnOrder([...CONTACTS_DEFAULT_COLUMN_ORDER]);
    setColumnSizing({});
    setColumnVisibility({});
  };

  const handleReorder = (activeId: string, overId: string) => {
    setColumnOrder((prev) => {
      const current = prev.filter((id) => id !== "actions");
      const activeIndex = current.indexOf(activeId);
      const overIndex = current.indexOf(overId);
      if (activeIndex === -1 || overIndex === -1) return prev;

      const next = [...current];
      next.splice(activeIndex, 1);
      next.splice(overIndex, 0, activeId);
      return normalizeColumnOrder([...next, "actions"]);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-contacts"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setColumnsDialogOpen(true)}
          >
            <Columns className="mr-2 h-4 w-4" />
            {t("contacts.columns")}
          </Button>
          <NewContactDialog open={newContactOpen} onOpenChange={setNewContactOpen} />
        </div>
      </div>

      <Table
        containerClassName="flex-1 min-h-0 rounded-md border"
        className="min-w-full"
        style={{ width: table.getTotalSize() }}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="relative group"
                >
                  <div className="flex min-w-0 items-center">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </div>

                  {header.column.getCanResize() ? (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute right-0 top-0 h-full w-1 touch-none select-none opacity-0 group-hover:opacity-100",
                        header.column.getIsResizing()
                          ? "bg-primary"
                          : "bg-border/40 hover:bg-border",
                      )}
                    />
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <TableRow key={i}>
                {table.getVisibleLeafColumns().map((col) => (
                  <TableCell key={col.id} style={{ width: col.getSize() }}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => onSelectContact(row.original)}
                data-testid={`row-contact-${row.original.id}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <User className="mb-2 h-8 w-8 opacity-50" />
                  <p>{t("contacts.noContacts")}</p>
                  <p className="text-sm">{t("contacts.noContactsDescription")}</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ContactsColumnsDialog
        open={columnsDialogOpen}
        onOpenChange={setColumnsDialogOpen}
        title={t("contacts.columns")}
        description={t("contacts.columnsHint")}
        resetLabel={t("common.reset")}
        doneLabel={t("common.close")}
        columnIds={orderedColumnIds}
        getColumnLabel={(id) => columnLabelById[id] || id}
        isColumnVisible={(id) => table.getColumn(id)?.getIsVisible() ?? true}
        onToggleColumnVisible={(id, nextVisible) => table.getColumn(id)?.toggleVisibility(nextVisible)}
        onReorder={handleReorder}
        onReset={handleResetColumns}
      />
    </div>
  );
}
