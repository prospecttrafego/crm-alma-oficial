import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActivityMutations } from "@/hooks/mutations";
import { activitiesApi } from "@/lib/api/activities";
import { contactsApi } from "@/lib/api/contacts";
import { dealsApi } from "@/lib/api/deals";
import { Plus, Search, Phone, Mail, Calendar, FileText, CheckSquare, Clock, Check } from "lucide-react";
import type { Activity, Contact, Deal } from "@shared/schema";

interface ActivityWithRelations extends Activity {
  contact?: Contact;
  deal?: Deal;
}

const activityIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  task: CheckSquare,
};

export default function ActivitiesPage() {
  const { t } = useTranslation();
  const { createActivity, completeActivity } = useActivityMutations();
  const [searchQuery, setSearchQuery] = useState("");
  const [newActivityOpen, setNewActivityOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: activities, isLoading } = useQuery<ActivityWithRelations[]>({
    queryKey: ["/api/activities"],
    queryFn: activitiesApi.list,
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    queryFn: contactsApi.list,
  });

  const { data: deals } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
    queryFn: dealsApi.list,
  });

  const handleCreateActivity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createActivity.mutate({
      type: formData.get("type") as Activity["type"],
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      contactId: formData.get("contactId") ? Number(formData.get("contactId")) : undefined,
      dealId: formData.get("dealId") ? Number(formData.get("dealId")) : undefined,
      dueDate: formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : undefined,
    }, {
      onSuccess: () => setNewActivityOpen(false),
    });
  };

  const filteredActivities = activities?.filter((activity) => {
    if (filterType !== "all" && activity.type !== filterType) return false;
    if (filterStatus !== "all" && activity.status !== filterStatus) return false;
    if (!searchQuery) return true;
    return activity.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isOverdue = (dueDate: Date | string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getActivityTypeLabel = (type: Activity["type"]) => {
    const key = `activities.types.${type}`;
    const translated = t(key);
    return translated === key ? type : translated;
  };

  const getActivityStatusLabel = (status: Activity["status"]) => {
    const key = `activities.${status}`;
    const translated = t(key);
    return translated === key ? status : translated;
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-activities-title">{t("activities.title")}</h1>
          <p className="text-muted-foreground">
            {t("activities.subtitle")}
          </p>
        </div>
        <Dialog open={newActivityOpen} onOpenChange={setNewActivityOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-activity">
              <Plus className="mr-2 h-4 w-4" />
              {t("activities.newActivity")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateActivity}>
              <DialogHeader>
                <DialogTitle>{t("activities.newActivity")}</DialogTitle>
                <DialogDescription>
                  {t("activities.newActivityDesc")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">{t("common.type")}</Label>
                  <Select name="type" required>
                    <SelectTrigger data-testid="select-activity-type">
                      <SelectValue placeholder={t("activities.selectType")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">{t("activities.types.task")}</SelectItem>
                      <SelectItem value="call">{t("activities.types.call")}</SelectItem>
                      <SelectItem value="email">{t("activities.types.email")}</SelectItem>
                      <SelectItem value="meeting">{t("activities.types.meeting")}</SelectItem>
                      <SelectItem value="note">{t("activities.types.note")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">{t("activities.activityTitle")}</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    data-testid="input-activity-title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">{t("common.description")}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    data-testid="input-activity-description"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">{t("activities.dueDate")}</Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    data-testid="input-activity-dueDate"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactId">{t("activities.contact")}</Label>
                  <select
                    id="contactId"
                    name="contactId"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid="select-activity-contact"
                  >
                    <option value="">{t("activities.selectContact")}</option>
                    {contacts?.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dealId">{t("activities.deal")}</Label>
                  <select
                    id="dealId"
                    name="dealId"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid="select-activity-deal"
                  >
                    <option value="">{t("activities.selectDeal")}</option>
                    {deals?.map((deal) => (
                      <option key={deal.id} value={deal.id}>
                        {deal.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewActivityOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createActivity.isPending}
                  data-testid="button-create-activity-submit"
                >
                  {createActivity.isPending ? t("common.saving") : t("common.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-activities"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-type">
            <SelectValue placeholder={t("activities.allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("activities.allTypes")}</SelectItem>
            <SelectItem value="task">{t("activities.types.task")}</SelectItem>
            <SelectItem value="call">{t("activities.types.call")}</SelectItem>
            <SelectItem value="email">{t("activities.types.email")}</SelectItem>
            <SelectItem value="meeting">{t("activities.types.meeting")}</SelectItem>
            <SelectItem value="note">{t("activities.types.note")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
            <SelectValue placeholder={t("activities.allStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("activities.allStatus")}</SelectItem>
            <SelectItem value="pending">{t("activities.pending")}</SelectItem>
            <SelectItem value="completed">{t("activities.completed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-md border p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : filteredActivities && filteredActivities.length > 0 ? (
          <div className="space-y-3">
            {filteredActivities.map((activity) => {
              const Icon = activityIcons[activity.type as keyof typeof activityIcons] || FileText;
              return (
                <div
                  key={activity.id}
                  className={`flex items-center gap-4 rounded-md border p-4 ${
                    activity.status === "completed" ? "opacity-60" : ""
                  }`}
                  data-testid={`card-activity-${activity.id}`}
                >
                  <button
                    onClick={() => {
                      if (activity.status !== "completed") {
                        completeActivity.mutate(activity.id);
                      }
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-accent"
                    disabled={activity.status === "completed"}
                    data-testid={`button-complete-activity-${activity.id}`}
                  >
                    {activity.status === "completed" ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        activity.status === "completed" ? "line-through" : ""
                      }`}
                    >
                      {activity.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="capitalize">
                        {getActivityTypeLabel(activity.type)}
                      </Badge>
                      {activity.contact && (
                        <span>
                          {activity.contact.firstName} {activity.contact.lastName}
                        </span>
                      )}
                      {activity.deal && (
                        <span className="text-primary">{activity.deal.title}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {activity.dueDate && (
                      <div
                        className={`flex items-center gap-1 text-sm ${
                          isOverdue(activity.dueDate) && activity.status !== "completed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {formatDate(activity.dueDate)}
                      </div>
                    )}
                    <Badge
                      variant={activity.status === "completed" ? "secondary" : "default"}
                    >
                      {getActivityStatusLabel(activity.status)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-md border">
            <div className="text-center text-muted-foreground">
              <CheckSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>{t("activities.noActivities")}</p>
              <p className="text-sm">{t("activities.noActivitiesDescription")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
