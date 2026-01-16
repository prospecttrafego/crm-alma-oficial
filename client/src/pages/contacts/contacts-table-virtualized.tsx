import { TableVirtuoso } from "react-virtuoso";

import { cn } from "@/lib/utils";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender, type Row, type Table as TanstackTable } from "@tanstack/react-table";
import type { ContactWithStats } from "@/lib/api/contacts";

type Props = {
  table: TanstackTable<ContactWithStats>;
  onSelectContact: (contact: ContactWithStats) => void;
};

export function ContactsTableVirtualized({ table, onSelectContact }: Props) {
  const rows = table.getRowModel().rows as Row<ContactWithStats>[];

  return (
    <TableVirtuoso
      style={{ height: "100%" }}
      data={rows}
      computeItemKey={(_index, row) => row.original.id}
      components={{
        Scroller: (props) => <div {...(props as any)} className="min-h-0 flex-1 overflow-auto rounded-md border" />,
        Table: ({ style, ...props }) => (
          <table
            {...props}
            style={{ ...style, width: table.getTotalSize(), minWidth: "100%" }}
            className="w-full caption-bottom text-sm"
          />
        ),
        TableHead: (props) => <TableHeader {...(props as any)} />,
        TableBody: (props) => <TableBody {...(props as any)} />,
        TableRow: ({ item, ...props }) => (
          <TableRow
            {...(props as any)}
            className="cursor-pointer"
            onClick={() => onSelectContact(item.original)}
            data-testid={`row-contact-${item.original.id}`}
          />
        ),
      }}
      fixedHeaderContent={() =>
        table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} style={{ width: header.getSize() }} className="group relative">
                <div className="flex min-w-0 items-center">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </div>
                {header.column.getCanResize() ? (
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={cn(
                      "absolute right-0 top-0 h-full w-1 touch-none select-none opacity-0 group-hover:opacity-100",
                      header.column.getIsResizing() ? "bg-primary" : "bg-border/40 hover:bg-border",
                    )}
                  />
                ) : null}
              </TableHead>
            ))}
          </TableRow>
        ))
      }
      itemContent={(_index, row) =>
        row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))
      }
    />
  );
}
