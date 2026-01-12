import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCalendarMutations } from "@/hooks/mutations";
import { calendarEventsApi } from "@/lib/api/calendarEvents";
import { contactsApi } from "@/lib/api/contacts";
import { dealsApi } from "@/lib/api/deals";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Trash2,
  Phone,
  Video,
  CheckSquare,
  Bell,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import type { Locale } from "date-fns";
import type { CalendarEvent, Contact, Deal, CalendarEventType } from "@shared/schema";
import type { CreateCalendarEventDTO } from "@shared/types";

type ViewMode = "month" | "week" | "day";

const eventTypeColors: Record<CalendarEventType, string> = {
  meeting: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
  call: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
  task: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
  reminder: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  other: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30",
};

const eventTypeIcons: Record<CalendarEventType, typeof CalendarIcon> = {
  meeting: Video,
  call: Phone,
  task: CheckSquare,
  reminder: Bell,
  other: CalendarIcon,
};

function EventForm({
  event,
  onSubmit,
  onCancel,
  contacts,
  deals,
  t,
}: {
  event?: CalendarEvent;
  onSubmit: (data: CreateCalendarEventDTO) => void;
  onCancel: () => void;
  contacts: Contact[];
  deals: Deal[];
  t: (key: string) => string;
}) {
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [type, setType] = useState<CalendarEventType>(event?.type || "meeting");
  const [startTime, setStartTime] = useState(
    event?.startTime ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [endTime, setEndTime] = useState(
    event?.endTime ? format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm") : format(addDays(new Date(), 0).setHours(new Date().getHours() + 1), "yyyy-MM-dd'T'HH:mm")
  );
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [location, setLocation] = useState(event?.location || "");
  const [contactId, setContactId] = useState<string>(event?.contactId?.toString() || "");
  const [dealId, setDealId] = useState<string>(event?.dealId?.toString() || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description: description || null,
      type,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      allDay,
      location: location || null,
      contactId: contactId ? parseInt(contactId) : null,
      dealId: dealId ? parseInt(dealId) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">{t("calendar.eventTitle")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("calendar.eventTitlePlaceholder")}
          required
          data-testid="input-event-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">{t("calendar.eventType")}</Label>
        <Select value={type} onValueChange={(v) => setType(v as CalendarEventType)}>
          <SelectTrigger data-testid="select-event-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="meeting">{t("activities.types.meeting")}</SelectItem>
            <SelectItem value="call">{t("activities.types.call")}</SelectItem>
            <SelectItem value="task">{t("activities.types.task")}</SelectItem>
            <SelectItem value="reminder">{t("calendar.reminder")}</SelectItem>
            <SelectItem value="other">{t("calendar.other")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="allDay"
          checked={allDay}
          onCheckedChange={setAllDay}
          data-testid="switch-all-day"
        />
        <Label htmlFor="allDay">{t("calendar.allDay")}</Label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">{t("calendar.startDate")}</Label>
          <Input
            id="startTime"
            type={allDay ? "date" : "datetime-local"}
            value={allDay ? startTime.split("T")[0] : startTime}
            onChange={(e) => setStartTime(allDay ? `${e.target.value}T00:00` : e.target.value)}
            required
            data-testid="input-start-time"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">{t("calendar.endDate")}</Label>
          <Input
            id="endTime"
            type={allDay ? "date" : "datetime-local"}
            value={allDay ? endTime.split("T")[0] : endTime}
            onChange={(e) => setEndTime(allDay ? `${e.target.value}T23:59` : e.target.value)}
            required
            data-testid="input-end-time"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">{t("calendar.location")}</Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t("calendar.locationPlaceholder")}
          data-testid="input-location"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("common.description")}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("calendar.descriptionPlaceholder")}
          data-testid="input-description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact">{t("pipeline.contact")}</Label>
          <Select value={contactId || "none"} onValueChange={(v) => setContactId(v === "none" ? "" : v)}>
            <SelectTrigger data-testid="select-contact">
              <SelectValue placeholder={t("calendar.selectContact")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("common.none")}</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.firstName} {c.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal">{t("activities.deal")}</Label>
          <Select value={dealId || "none"} onValueChange={(v) => setDealId(v === "none" ? "" : v)}>
            <SelectTrigger data-testid="select-deal">
              <SelectValue placeholder={t("calendar.selectDeal")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("common.none")}</SelectItem>
              {deals.map((d) => (
                <SelectItem key={d.id} value={d.id.toString()}>
                  {d.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
          {t("common.cancel")}
        </Button>
        <Button type="submit" data-testid="button-save-event">
          {event ? t("common.update") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}

function DayCell({
  date,
  events,
  currentMonth,
  onEventClick,
  onAddEvent,
  moreLabel,
}: {
  date: Date;
  events: CalendarEvent[];
  currentMonth: Date;
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
  moreLabel: string;
}) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.startTime), date));
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);

  return (
    <div
      className={`min-h-[100px] border-r border-b p-1 ${
        isCurrentMonth ? "bg-background" : "bg-muted/30"
      } ${today ? "ring-2 ring-primary ring-inset" : ""}`}
      onClick={() => onAddEvent(date)}
      data-testid={`day-cell-${format(date, "yyyy-MM-dd")}`}
    >
      <div className={`text-sm mb-1 ${isCurrentMonth ? "" : "text-muted-foreground"} ${today ? "font-bold text-primary" : ""}`}>
        {format(date, "d")}
      </div>
      <div className="space-y-1">
        {dayEvents.slice(0, 3).map((event) => {
          const Icon = eventTypeIcons[event.type || "other"];
          return (
            <div
              key={event.id}
              className={`text-xs p-1 rounded border cursor-pointer truncate ${eventTypeColors[event.type || "other"]}`}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(event);
              }}
              data-testid={`event-${event.id}`}
            >
              <Icon className="inline h-3 w-3 mr-1" />
              {event.title}
            </div>
          );
        })}
        {dayEvents.length > 3 && (
          <div className="text-xs text-muted-foreground">
            +{dayEvents.length - 3} {moreLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function MonthView({
  currentDate,
  events,
  onEventClick,
  onAddEvent,
  weekdays,
  moreLabel,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
  weekdays: string[];
  moreLabel: string;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="grid grid-cols-7 bg-muted">
        {weekdays.map((d) => (
          <div key={d} className="text-center py-2 text-sm font-medium border-r last:border-r-0">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => (
          <DayCell
            key={i}
            date={d}
            events={events}
            currentMonth={currentDate}
            onEventClick={onEventClick}
            onAddEvent={onAddEvent}
            moreLabel={moreLabel}
          />
        ))}
      </div>
    </div>
  );
}

function WeekView({
  currentDate,
  events,
  onEventClick,
  onAddEvent,
  locale,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
  locale: Locale;
}) {
  const weekStart = startOfWeek(currentDate);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(weekStart, i));
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="grid grid-cols-8 bg-muted">
        <div className="text-center py-2 text-sm font-medium border-r"></div>
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={`text-center py-2 text-sm font-medium border-r last:border-r-0 ${
              isToday(d) ? "bg-primary/10 text-primary" : ""
            }`}
          >
            <div>{format(d, "EEE", { locale })}</div>
            <div className="text-lg">{format(d, "d")}</div>
          </div>
        ))}
      </div>
      <ScrollArea className="h-[600px]">
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b min-h-[48px]">
              <div className="text-xs text-muted-foreground p-1 border-r text-right">
                {format(new Date().setHours(hour, 0), "h a", { locale })}
              </div>
              {days.map((d) => {
                const dayEvents = events.filter((e) => {
                  const eventStart = new Date(e.startTime);
                  return isSameDay(eventStart, d) && eventStart.getHours() === hour;
                });
                return (
                  <div
                    key={d.toISOString()}
                    className="border-r last:border-r-0 p-0.5 cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      const newDate = new Date(d);
                      newDate.setHours(hour);
                      onAddEvent(newDate);
                    }}
                  >
                    {dayEvents.map((event) => {
                      const Icon = eventTypeIcons[event.type || "other"];
                      return (
                        <div
                          key={event.id}
                          className={`text-xs p-1 rounded border cursor-pointer truncate ${eventTypeColors[event.type || "other"]}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          data-testid={`event-${event.id}`}
                        >
                          <Icon className="inline h-3 w-3 mr-1" />
                          {event.title}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function DayView({
  currentDate,
  events,
  onEventClick,
  onAddEvent,
  locale,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
  locale: Locale;
}) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.startTime), currentDate));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="bg-muted p-3 text-center">
        <div className="text-lg font-medium">
          {format(currentDate, "EEEE, MMMM d, yyyy", { locale })}
        </div>
      </div>
      <ScrollArea className="h-[600px]">
        <div className="relative">
          {hours.map((hour) => {
            const hourEvents = dayEvents.filter((e) => new Date(e.startTime).getHours() === hour);
            return (
              <div
                key={hour}
                className="grid grid-cols-[80px_1fr] border-b min-h-[48px] cursor-pointer hover:bg-muted/30"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setHours(hour, 0, 0, 0);
                  onAddEvent(newDate);
                }}
              >
                <div className="text-xs text-muted-foreground p-2 border-r text-right">
                  {format(new Date().setHours(hour, 0), "h:mm a", { locale })}
                </div>
                <div className="p-1 space-y-1">
                  {hourEvents.map((event) => {
                    const Icon = eventTypeIcons[event.type || "other"];
                    return (
                      <div
                        key={event.id}
                        className={`p-2 rounded border ${eventTypeColors[event.type || "other"]}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        data-testid={`event-${event.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{event.title}</span>
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(event.startTime), "h:mm a", { locale })} - {format(new Date(event.endTime), "h:mm a", { locale })}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function CalendarPage() {
  const { t, language } = useTranslation();
  const locale = language === "pt-BR" ? ptBR : enUS;
  const weekdays = [
    t("calendar.weekdaysShort.sun"),
    t("calendar.weekdaysShort.mon"),
    t("calendar.weekdaysShort.tue"),
    t("calendar.weekdaysShort.wed"),
    t("calendar.weekdaysShort.thu"),
    t("calendar.weekdaysShort.fri"),
    t("calendar.weekdaysShort.sat"),
  ];
  const moreLabel = t("calendar.more");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);
  const { createEvent, updateEvent, deleteEvent } = useCalendarMutations();

  const dateRange = useMemo(() => {
    const start = startOfMonth(subMonths(currentDate, 1));
    const end = endOfMonth(addMonths(currentDate, 1));
    return { start, end };
  }, [currentDate]);

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      return calendarEventsApi.listByRange(dateRange.start, dateRange.end);
    },
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    queryFn: contactsApi.list,
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
    queryFn: dealsApi.list,
  });

  const handleNavigate = (direction: "prev" | "next") => {
    if (viewMode === "month") {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === "prev" ? addDays(currentDate, -1) : addDays(currentDate, 1));
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setNewEventDate(null);
    setIsDialogOpen(true);
  };

  const handleAddEvent = (date: Date) => {
    setSelectedEvent(null);
    setNewEventDate(date);
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: CreateCalendarEventDTO) => {
    if (selectedEvent) {
      updateEvent.mutate(
        { id: selectedEvent.id, data },
        {
          onSuccess: () => {
            setIsDialogOpen(false);
            setSelectedEvent(null);
          },
        }
      );
    } else {
      createEvent.mutate(data, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setNewEventDate(null);
        },
      });
    }
  };

  const getTitle = () => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy", { locale });
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return `${format(weekStart, "MMM d", { locale })} - ${format(weekEnd, "MMM d, yyyy", { locale })}`;
    }
    return format(currentDate, "MMMM d, yyyy", { locale });
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">{t("calendar.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNavigate("prev")}
            data-testid="button-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(new Date())}
            data-testid="button-today"
          >
            {t("calendar.today")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNavigate("next")}
            data-testid="button-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium min-w-[200px] text-center" data-testid="text-current-date">
            {getTitle()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[120px]" data-testid="select-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t("calendar.month")}</SelectItem>
              <SelectItem value="week">{t("calendar.week")}</SelectItem>
              <SelectItem value="day">{t("calendar.day")}</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-event" onClick={() => { setSelectedEvent(null); setNewEventDate(new Date()); }}>
                <Plus className="h-4 w-4 mr-2" />
                {t("calendar.newEvent")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{selectedEvent ? t("calendar.editEvent") : t("calendar.newEvent")}</DialogTitle>
                <DialogDescription>
                  {selectedEvent ? t("calendar.editEventDesc") : t("calendar.newEventDesc")}
                </DialogDescription>
              </DialogHeader>
              <EventForm
                event={selectedEvent || (newEventDate ? { startTime: newEventDate, endTime: addDays(newEventDate, 0) } as CalendarEvent : undefined)}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setSelectedEvent(null);
                  setNewEventDate(null);
                }}
                contacts={contacts}
                deals={deals}
                t={t}
              />
              {selectedEvent && (
                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() =>
                      deleteEvent.mutate(selectedEvent.id, {
                        onSuccess: () => {
                          setIsDialogOpen(false);
                          setSelectedEvent(null);
                        },
                      })
                    }
                    data-testid="button-delete-event"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("calendar.deleteEvent")}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">{t("common.loading")}</div>
          </div>
        ) : viewMode === "month" ? (
          <MonthView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEventClick}
            onAddEvent={handleAddEvent}
            weekdays={weekdays}
            moreLabel={moreLabel}
          />
        ) : viewMode === "week" ? (
          <WeekView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEventClick}
            onAddEvent={handleAddEvent}
            locale={locale}
          />
        ) : (
          <DayView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEventClick}
            onAddEvent={handleAddEvent}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}
