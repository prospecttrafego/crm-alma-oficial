import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useContactMutations } from "@/hooks/mutations";
import { contactsApi } from "@/lib/api/contacts";
import { activitiesApi } from "@/lib/api/activities";
import { Plus, Search, Mail, Phone, Building2, User, MoreHorizontal, Calendar, FileText, CheckSquare } from "lucide-react";
import { EntityHistory } from "@/components/entity-history";
import { LeadScorePanel } from "@/components/LeadScorePanel";
import type { Contact, Company, Activity } from "@shared/schema";

interface ContactWithRelations extends Contact {
  company?: Company;
}

export default function ContactsPage() {
  const { t } = useTranslation();
  const { createContact } = useContactMutations();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactWithRelations | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);

  const { data: contacts, isLoading } = useQuery<ContactWithRelations[]>({
    queryKey: ["/api/contacts"],
    queryFn: contactsApi.list,
  });

  // REMOVIDO - Não precisa mais carregar lista de empresas
  // Agora usamos input de texto com auto-criação de empresa no backend
  const { data: activities } = useQuery<Activity[]>({
    queryKey: ["/api/contacts", selectedContact?.id, "activities"],
    queryFn: () => activitiesApi.listByContact(selectedContact!.id),
    enabled: !!selectedContact,
  });

  // Tipo para criação de contato (usa companyName em vez de companyId)
  type CreateContactData = Omit<Partial<Contact>, 'companyId'> & { companyName?: string };

  const handleCreateContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createContact.mutate({
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      jobTitle: formData.get("jobTitle") as string,
      companyName: (formData.get("companyName") as string) || undefined,
    }, {
      onSuccess: () => setNewContactOpen(false),
    });
  };

  const filteredContacts = contacts?.filter((contact) => {
    if (!searchQuery) return true;
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    return (
      fullName.includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getInitials = (contact: Contact) => {
    return `${contact.firstName?.[0] || ""}${contact.lastName?.[0] || ""}`.toUpperCase();
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-contacts-title">{t("contacts.title")}</h1>
          <p className="text-muted-foreground">
            {t("contacts.subtitle")}
          </p>
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
                <DialogDescription>
                  {t("contacts.newContactDescription")}
                </DialogDescription>
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
                    <Input
                      id="lastName"
                      name="lastName"
                      data-testid="input-contact-lastName"
                    />
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
                  <Input
                    id="phone"
                    name="phone"
                    data-testid="input-contact-phone"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="jobTitle">{t("contacts.jobTitle")}</Label>
                  <Input
                    id="jobTitle"
                    name="jobTitle"
                    data-testid="input-contact-jobTitle"
                  />
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewContactOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createContactMutation.isPending}
                  data-testid="button-create-contact-submit"
                >
                  {createContactMutation.isPending ? t("common.saving") : t("common.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
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
      </div>

      <div className="flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("common.phone")}</TableHead>
              <TableHead>{t("contacts.company")}</TableHead>
              <TableHead>{t("contacts.jobTitle")}</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
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
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))
            ) : filteredContacts && filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedContact(contact)}
                  data-testid={`row-contact-${contact.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(contact)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {contact.firstName} {contact.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.email || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.phone || "-"}
                  </TableCell>
                  <TableCell>
                    {contact.company ? (
                      <Badge variant="secondary">{contact.company.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.jobTitle || "-"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
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
                          {activity.type === "call" && <Phone className="h-4 w-4 text-muted-foreground" />}
                          {activity.type === "email" && <Mail className="h-4 w-4 text-muted-foreground" />}
                          {activity.type === "meeting" && <Calendar className="h-4 w-4 text-muted-foreground" />}
                          {activity.type === "note" && <FileText className="h-4 w-4 text-muted-foreground" />}
                          {activity.type === "task" && <CheckSquare className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{activity.title}</p>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground">
                              {activity.description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(activity.createdAt!).toLocaleDateString("pt-BR")}
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
