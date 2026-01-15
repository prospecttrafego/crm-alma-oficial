/**
 * Contacts Page
 * Advanced table with @tanstack/react-table for sorting, filtering, and column visibility
 */

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useContactMutations } from "@/hooks/mutations";
import { contactsApi, type ContactWithStats } from "@/lib/api/contacts";
import { activitiesApi } from "@/lib/api/activities";
import {
  Plus,
  Search,
  Mail,
  Phone,
  Building2,
  User,
  MoreHorizontal,
  Calendar,
  FileText,
  CheckSquare,
  ArrowUpDown,
  Columns,
  Pencil,
  Trash2,
  DollarSign,
  Clock,
} from "lucide-react";
import { EntityHistory } from "@/components/entity-history";
import { LeadScorePanel } from "@/components/LeadScorePanel";
import type { Activity } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

const COLUMN_VISIBILITY_KEY = "contacts-column-visibility";

export default function ContactsPage() {
  const { t, language } = useTranslation();
  const { createContact, deleteContact } = useContactMutations();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactWithStats | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist column visibility
  useEffect(() => {
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["/api/contacts", "withStats"],
    queryFn: contactsApi.listWithStats,
  });

  const { data: activities } = useQuery<Activity[]>({
    queryKey: ["/api/contacts", selectedContact?.id, "activities"],
    queryFn: () => activitiesApi.listByContact(selectedContact!.id),
    enabled: !!selectedContact,
  });

  const handleCreateContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createContact.mutate(
      {
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        email: formData.get("email") as string,
        phone: formData.get("phone") as string,
        jobTitle: formData.get("jobTitle") as string,
        companyName: (formData.get("companyName") as string) || undefined,
      },
      {
        onSuccess: () => setNewContactOpen(false),
      }
    );
  };

  const handleDeleteContact = (contact: ContactWithStats) => {
    if (window.confirm(t("contacts.deleteConfirm", { name: `${contact.firstName} ${contact.lastName || ""}` }))) {
      deleteContact.mutate(contact.id);
    }
  };

  const getInitials = (contact: ContactWithStats) => {
    return `${contact.firstName?.[0] || ""}${contact.lastName?.[0] || ""}`.toUpperCase();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === "pt-BR" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatRelativeDate = (date: string | null) => {
    if (!date) return "-";
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: language === "pt-BR" ? ptBR : enUS,
    });
  };

  // Define columns
  const columns = useMemo<ColumnDef<ContactWithStats>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            {t("common.name")}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        accessorFn: (row) => `${row.firstName} ${row.lastName || ""}`,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(row.original)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">
              {row.original.firstName} {row.original.lastName}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: t("common.email"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email || "-"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: t("common.phone"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.phone || "-"}</span>
        ),
      },
      {
        accessorKey: "company",
        header: t("contacts.company"),
        accessorFn: (row) => row.company?.name || "",
        cell: ({ row }) =>
          row.original.company ? (
            <Badge variant="secondary">{row.original.company.name}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "totalDealsValue",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            <DollarSign className="mr-1 h-4 w-4" />
            {t("contacts.dealsValue")}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className={row.original.totalDealsValue > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
            {row.original.totalDealsValue > 0 ? formatCurrency(row.original.totalDealsValue) : "-"}
          </span>
        ),
      },
      {
        accessorKey: "openDealsCount",
        header: t("contacts.openDeals"),
        cell: ({ row }) => (
          <span className={row.original.openDealsCount > 0 ? "font-medium" : "text-muted-foreground"}>
            {row.original.openDealsCount || "-"}
          </span>
        ),
      },
      {
        accessorKey: "tags",
        header: t("contacts.tags"),
        cell: ({ row }) =>
          row.original.tags && row.original.tags.length > 0 ? (
            <div className="flex gap-1 flex-wrap">
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
        accessorKey: "source",
        header: t("contacts.source"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.source || "-"}</span>
        ),
      },
      {
        accessorKey: "owner",
        header: t("contacts.owner"),
        accessorFn: (row) => row.owner ? `${row.owner.firstName || ""} ${row.owner.lastName || ""}` : "",
        cell: ({ row }) =>
          row.original.owner ? (
            <span className="text-muted-foreground">
              {row.original.owner.firstName} {row.original.owner.lastName}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "lastActivityAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            <Clock className="mr-1 h-4 w-4" />
            {t("contacts.lastActivity")}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatRelativeDate(row.original.lastActivityAt)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: t("contacts.createdAt"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.createdAt
              ? new Date(row.original.createdAt).toLocaleDateString(
                  language === "pt-BR" ? "pt-BR" : "en-US"
                )
              : "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
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
              <DropdownMenuItem onClick={() => setSelectedContact(row.original)}>
                <User className="mr-2 h-4 w-4" />
                {t("contacts.viewDetails")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4" />
                {t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteContact(row.original);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, language]
  );

  const table = useReactTable({
    data: contacts || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
      globalFilter: searchQuery,
    },
    onGlobalFilterChange: setSearchQuery,
  });

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-contacts-title">
            {t("contacts.title")}
          </h1>
          <p className="text-muted-foreground">{t("contacts.subtitle")}</p>
        </div>
        <Dialog open={newContactOpen} onOpenChange={setNewContactOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-contact">
              <Plus className="mr-2 h-4 w-4" />
              {t("contacts.newContact")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateContact}>
              <DialogHeader>
                <DialogTitle>{t("contacts.newContact")}</DialogTitle>
                <DialogDescription>{t("contacts.newContactDescription")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">{t("contacts.firstName")}</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      required
                      data-testid="input-contact-firstName"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">{t("contacts.lastName")}</Label>
                    <Input id="lastName" name="lastName" data-testid="input-contact-lastName" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t("contacts.email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    data-testid="input-contact-email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">{t("contacts.phone")}</Label>
                  <Input id="phone" name="phone" data-testid="input-contact-phone" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="jobTitle">{t("contacts.jobTitle")}</Label>
                  <Input id="jobTitle" name="jobTitle" data-testid="input-contact-jobTitle" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="companyName">{t("contacts.company")}</Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    placeholder={t("contacts.companyPlaceholder")}
                    data-testid="input-contact-companyName"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewContactOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createContact.isPending}
                  data-testid="button-create-contact-submit"
                >
                  {createContact.isPending ? t("common.saving") : t("common.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-contacts"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns className="mr-2 h-4 w-4" />
              {t("contacts.columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{t("contacts.toggleColumns")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id === "name"
                      ? t("common.name")
                      : column.id === "email"
                        ? t("common.email")
                        : column.id === "phone"
                          ? t("common.phone")
                          : column.id === "company"
                            ? t("contacts.company")
                            : column.id === "totalDealsValue"
                              ? t("contacts.dealsValue")
                              : column.id === "openDealsCount"
                                ? t("contacts.openDeals")
                                : column.id === "tags"
                                  ? t("contacts.tags")
                                  : column.id === "source"
                                    ? t("contacts.source")
                                    : column.id === "owner"
                                      ? t("contacts.owner")
                                      : column.id === "lastActivityAt"
                                        ? t("contacts.lastActivity")
                                        : column.id === "createdAt"
                                          ? t("contacts.createdAt")
                                          : column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedContact(row.original)}
                  data-testid={`row-contact-${row.original.id}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
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
      </div>

      <Sheet open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedContact ? getInitials(selectedContact) : ""}
                </AvatarFallback>
              </Avatar>
              <span>
                {selectedContact?.firstName} {selectedContact?.lastName}
              </span>
            </SheetTitle>
            <SheetDescription>{t("contacts.detailsAndActivity")}</SheetDescription>
          </SheetHeader>

          {selectedContact && (
            <div className="mt-6 space-y-6">
              <div className="space-y-3">
                {selectedContact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.email}</span>
                  </div>
                )}
                {selectedContact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.phone}</span>
                  </div>
                )}
                {selectedContact.company && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.company.name}</span>
                  </div>
                )}
                {selectedContact.jobTitle && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.jobTitle}</span>
                  </div>
                )}
              </div>

              {/* Stats summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">{t("contacts.dealsValue")}</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(selectedContact.totalDealsValue)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">{t("contacts.openDeals")}</div>
                  <div className="text-lg font-semibold">{selectedContact.openDealsCount}</div>
                </div>
              </div>

              <LeadScorePanel entityType="contact" entityId={selectedContact.id} />

              <div>
                <h4 className="mb-3 font-semibold">{t("contacts.activityTimeline")}</h4>
                {activities && activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 rounded-md border p-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                          {activity.type === "call" && (
                            <Phone className="h-4 w-4 text-muted-foreground" />
                          )}
                          {activity.type === "email" && (
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          )}
                          {activity.type === "meeting" && (
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                          )}
                          {activity.type === "note" && (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          {activity.type === "task" && (
                            <CheckSquare className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{activity.title}</p>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {activity.createdAt
                              ? new Date(activity.createdAt).toLocaleDateString(
                                  language === "pt-BR" ? "pt-BR" : "en-US"
                                )
                              : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-md border text-muted-foreground">
                    {t("contacts.noActivities")}
                  </div>
                )}
              </div>

              <div className="rounded-md border">
                <EntityHistory entityType="contact" entityId={selectedContact.id} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
