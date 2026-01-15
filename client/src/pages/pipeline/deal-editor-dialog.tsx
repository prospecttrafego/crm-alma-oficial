import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useDealMutations } from "@/hooks/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityHistory } from "@/components/entity-history";
import { LeadScorePanel } from "@/components/LeadScorePanel";
import { Plus, X } from "lucide-react";
import type { Contact, Deal } from "@shared/schema";

type CustomFieldRow = { key: string; value: string };

type DealEditorDialogProps = {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
};

function toDateInputValue(value: unknown) {
  if (!value) return "";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function DealEditorDialog({ deal, open, onOpenChange, contacts }: DealEditorDialogProps) {
  const { t } = useTranslation();
  const { updateDeal } = useDealMutations();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [contactId, setContactId] = useState<string>("none");
  const [probability, setProbability] = useState(0);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);

  const initialCustomFields = useMemo((): CustomFieldRow[] => {
    if (!deal?.customFields || typeof deal.customFields !== "object") return [];
    return Object.entries(deal.customFields as Record<string, unknown>)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, val]) => ({ key, value: val == null ? "" : String(val) }));
  }, [deal?.customFields]);

  useEffect(() => {
    if (!open || !deal) return;

    setTitle(deal.title || "");
    setValue(deal.value ? String(deal.value) : "");
    setContactId(deal.contactId ? String(deal.contactId) : "none");
    setProbability(Number(deal.probability || 0));
    setExpectedCloseDate(toDateInputValue(deal.expectedCloseDate));
    setSource(deal.source || "");
    setNotes(deal.notes || "");
    setTags(Array.isArray(deal.tags) ? deal.tags : []);
    setNewTag("");
    setCustomFields(initialCustomFields);
  }, [deal, initialCustomFields, open]);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  };

  const handleSave = () => {
    if (!deal) return;

    const customFieldsObject = customFields.reduce<Record<string, unknown>>((acc, row) => {
      const key = row.key.trim();
      if (!key) return acc;
      acc[key] = row.value;
      return acc;
    }, {});

    updateDeal.mutate(
      {
        id: deal.id,
        data: {
          title: title.trim(),
          value: value.trim() ? value.trim() : null,
          contactId: contactId === "none" ? null : Number(contactId),
          probability,
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
          source: source.trim() ? source.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
          tags: tags.length > 0 ? tags : null,
          customFields: Object.keys(customFieldsObject).length > 0 ? customFieldsObject : null,
        },
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{deal ? deal.title : t("pipeline.editDeal")}</DialogTitle>
          <DialogDescription>{t("pipeline.editDeal")}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details">{t("common.details")}</TabsTrigger>
            <TabsTrigger value="custom">{t("pipeline.customFields")}</TabsTrigger>
            <TabsTrigger value="history">{t("entityHistory.title")}</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="dealTitle">{t("pipeline.dealTitle")}</Label>
                <Input
                  id="dealTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("pipeline.dealTitlePlaceholder")}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="dealValue">{t("pipeline.dealValue")}</Label>
                  <Input
                    id="dealValue"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dealContact">{t("pipeline.contact")}</Label>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger id="dealContact">
                      <SelectValue placeholder={t("pipeline.contact")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.firstName} {c.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="dealProbability">{t("pipeline.probability")}</Label>
                    <span className="text-sm text-muted-foreground">{probability}%</span>
                  </div>
                  <Input
                    id="dealProbability"
                    type="range"
                    min="0"
                    max="100"
                    value={probability}
                    onChange={(e) => setProbability(Number(e.target.value))}
                    className="h-2"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dealExpectedCloseDate">{t("pipeline.expectedCloseDate")}</Label>
                  <Input
                    id="dealExpectedCloseDate"
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dealSource">{t("pipeline.source")}</Label>
                <Input
                  id="dealSource"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder={t("pipeline.sourcePlaceholder")}
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("common.tags")}</Label>
                <div className="flex flex-wrap gap-2 rounded-md border p-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        className="ml-1 inline-flex items-center text-muted-foreground hover:text-foreground"
                        onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                        aria-label={t("common.delete")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(newTag);
                        setNewTag("");
                      }
                    }}
                    placeholder={t("pipeline.tagsPlaceholder")}
                    className="h-8 w-[220px] border-0 p-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dealNotes">{t("common.notes")}</Label>
                <Textarea
                  id="dealNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("common.description")}
                  rows={4}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <div className="space-y-3 py-2">
              <div className="text-sm text-muted-foreground">{t("pipeline.customFieldsDescription")}</div>

              <div className="space-y-2">
                {customFields.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <Input
                      value={row.key}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)),
                        )
                      }
                      placeholder={t("pipeline.customFieldKey")}
                    />
                    <Input
                      value={row.value}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)),
                        )
                      }
                      placeholder={t("pipeline.customFieldValue")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomFields((prev) => [...prev, { key: "", value: "" }])}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("pipeline.addCustomField")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history">
            {deal ? (
              <div className="space-y-4 py-2">
                <LeadScorePanel entityType="deal" entityId={deal.id} />
                <div className="rounded-md border">
                  <EntityHistory entityType="deal" entityId={deal.id} />
                </div>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!title.trim() || updateDeal.isPending}>
            {updateDeal.isPending ? t("common.saving") : t("common.update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

