import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/contexts/LanguageContext";
import { activitiesApi } from "@/lib/api/activities";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EntityHistory } from "@/components/entity-history";
import { LeadScorePanel } from "@/components/LeadScorePanel";
import {
  Calendar,
  CheckSquare,
  FileText,
  Mail,
  Phone,
  Building2,
  User,
} from "lucide-react";
import type { Activity } from "@shared/schema";
import type { ContactWithStats } from "@/lib/api/contacts";

type ContactDetailsSheetProps = {
  contact: ContactWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ContactDetailsSheet({ contact, open, onOpenChange }: ContactDetailsSheetProps) {
  const { t, language } = useTranslation();

  const { data: activities } = useQuery<Activity[]>({
    queryKey: ["/api/contacts", contact?.id, "activities"],
    queryFn: () => activitiesApi.listByContact(contact!.id),
    enabled: !!contact && open,
  });

  const getInitials = (c: ContactWithStats) => {
    return `${c.firstName?.[0] || ""}${c.lastName?.[0] || ""}`.toUpperCase();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === "pt-BR" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {contact ? getInitials(contact) : ""}
              </AvatarFallback>
            </Avatar>
            <span>
              {contact?.firstName} {contact?.lastName}
            </span>
          </SheetTitle>
          <SheetDescription>{t("contacts.detailsAndActivity")}</SheetDescription>
        </SheetHeader>

        {contact && (
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.company.name}</span>
                </div>
              )}
              {contact.jobTitle && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.jobTitle}</span>
                </div>
              )}
              {contact.source && (
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{contact.source}</Badge>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">{t("contacts.dealsValue")}</div>
                <div className="text-lg font-semibold text-green-600">
                  {formatCurrency(contact.totalDealsValue)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">{t("contacts.openDeals")}</div>
                <div className="text-lg font-semibold">{contact.openDealsCount}</div>
              </div>
            </div>

            <LeadScorePanel entityType="contact" entityId={contact.id} />

            <div>
              <h4 className="mb-3 font-semibold">{t("contacts.activityTimeline")}</h4>
              {activities && activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 rounded-md border p-3">
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
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {activity.createdAt
                            ? new Date(activity.createdAt).toLocaleDateString(
                                language === "pt-BR" ? "pt-BR" : "en-US",
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
              <EntityHistory entityType="contact" entityId={contact.id} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

