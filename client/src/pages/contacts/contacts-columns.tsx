import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { ArrowUpDown, Clock, DollarSign, MoreHorizontal, Trash2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTimeFromNow } from "@/lib/relativeTime";
import type { ContactWithStats } from "@/lib/api/contacts";

export const CONTACTS_DEFAULT_COLUMN_ORDER = [
  "name",
  "email",
  "phone",
  "company",
  "totalDealsValue",
  "openDealsCount",
  "tags",
  "source",
  "owner",
  "lastActivityAt",
  "createdAt",
  "actions",
] as const;

export const CONTACTS_DEFAULT_COLUMN_SIZING: Record<string, number> = {
  name: 260,
  email: 260,
  phone: 170,
  company: 200,
  totalDealsValue: 180,
  openDealsCount: 140,
  tags: 220,
  source: 160,
  owner: 200,
  lastActivityAt: 170,
  createdAt: 150,
  actions: 64,
};

export function getContactsColumnsMeta(
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  return [
    { id: "name", label: t("common.name") },
    { id: "email", label: t("common.email") },
    { id: "phone", label: t("common.phone") },
    { id: "company", label: t("contacts.company") },
    { id: "totalDealsValue", label: t("contacts.dealsValue") },
    { id: "openDealsCount", label: t("contacts.openDeals") },
    { id: "tags", label: t("contacts.tags") },
    { id: "source", label: t("contacts.source") },
    { id: "owner", label: t("contacts.owner") },
    { id: "lastActivityAt", label: t("contacts.lastActivity") },
    { id: "createdAt", label: t("contacts.createdAt") },
    { id: "actions", label: t("common.actions") },
  ] as const;
}

type ContactsColumnsParams = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  language: string;
  onViewDetails: (contact: ContactWithStats) => void;
  onDeleteContact: (contact: ContactWithStats) => void;
};

export function createContactsColumns({
  t,
  language,
  onViewDetails,
  onDeleteContact,
}: ContactsColumnsParams): ColumnDef<ContactWithStats>[] {
  const getInitials = (contact: ContactWithStats) =>
    `${contact.firstName?.[0] || ""}${contact.lastName?.[0] || ""}`.toUpperCase();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(language === "pt-BR" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatRelativeDate = (date: string | null) => {
    if (!date) return "-";
    return formatRelativeTimeFromNow(date, {
      locale: language === "pt-BR" ? "pt-BR" : "en-US",
      justNow: t("notifications.justNow"),
    });
  };

  const sortableHeader = (label: string, column: any, icon?: ReactNode) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="-ml-3 h-8 px-2"
    >
      {icon ? <span className="mr-1 inline-flex">{icon}</span> : null}
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  return [
    {
      id: "name",
      accessorFn: (row) => `${row.firstName} ${row.lastName || ""}`.trim(),
      header: ({ column }) => sortableHeader(t("common.name"), column),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.name,
      minSize: 200,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(row.original)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate font-medium">
            {row.original.firstName} {row.original.lastName}
          </span>
        </div>
      ),
    },
    {
      id: "email",
      accessorKey: "email",
      header: t("common.email"),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.email,
      minSize: 180,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">{row.original.email || "-"}</span>
      ),
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: t("common.phone"),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.phone,
      minSize: 140,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">{row.original.phone || "-"}</span>
      ),
    },
    {
      id: "company",
      header: t("contacts.company"),
      accessorFn: (row) => row.company?.name || "",
      size: CONTACTS_DEFAULT_COLUMN_SIZING.company,
      minSize: 160,
      cell: ({ row }) =>
        row.original.company ? (
          <Badge variant="secondary" className="max-w-full truncate">
            {row.original.company.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "totalDealsValue",
      accessorKey: "totalDealsValue",
      header: ({ column }) => sortableHeader(t("contacts.dealsValue"), column, <DollarSign className="h-4 w-4" />),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.totalDealsValue,
      minSize: 150,
      cell: ({ row }) => (
        <span
          className={
            row.original.totalDealsValue > 0
              ? "text-green-600 font-medium"
              : "text-muted-foreground"
          }
        >
          {row.original.totalDealsValue > 0 ? formatCurrency(row.original.totalDealsValue) : "-"}
        </span>
      ),
    },
    {
      id: "openDealsCount",
      accessorKey: "openDealsCount",
      header: t("contacts.openDeals"),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.openDealsCount,
      minSize: 120,
      cell: ({ row }) => (
        <span className={row.original.openDealsCount > 0 ? "font-medium" : "text-muted-foreground"}>
          {row.original.openDealsCount || "-"}
        </span>
      ),
    },
    {
      id: "tags",
      accessorKey: "tags",
      header: t("contacts.tags"),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.tags,
      minSize: 180,
      cell: ({ row }) =>
        row.original.tags && row.original.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.original.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {row.original.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{row.original.tags.length - 2}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "source",
      accessorKey: "source",
      header: t("contacts.source"),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.source,
      minSize: 140,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">{row.original.source || "-"}</span>
      ),
    },
    {
      id: "owner",
      accessorFn: (row) => (row.owner ? `${row.owner.firstName || ""} ${row.owner.lastName || ""}`.trim() : ""),
      header: t("contacts.owner"),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.owner,
      minSize: 160,
      cell: ({ row }) =>
        row.original.owner ? (
          <span className="block truncate text-muted-foreground">
            {row.original.owner.firstName} {row.original.owner.lastName}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "lastActivityAt",
      accessorKey: "lastActivityAt",
      header: ({ column }) => sortableHeader(t("contacts.lastActivity"), column, <Clock className="h-4 w-4" />),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.lastActivityAt,
      minSize: 150,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">
          {formatRelativeDate(row.original.lastActivityAt)}
        </span>
      ),
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: t("contacts.createdAt"),
      size: CONTACTS_DEFAULT_COLUMN_SIZING.createdAt,
      minSize: 130,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">
          {row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString(language === "pt-BR" ? "pt-BR" : "en-US")
            : "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      size: CONTACTS_DEFAULT_COLUMN_SIZING.actions,
      minSize: CONTACTS_DEFAULT_COLUMN_SIZING.actions,
      maxSize: CONTACTS_DEFAULT_COLUMN_SIZING.actions,
      enableResizing: false,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onViewDetails(row.original)}>
              <User className="mr-2 h-4 w-4" />
              {t("contacts.viewDetails")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteContact(row.original);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
