import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/contexts/LanguageContext";
import type { Contact } from "@shared/schema";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  contacts: Contact[];
  probabilityValue: number;
  onProbabilityValueChange: (value: number) => void;
  submitting: boolean;
};

export function NewDealDialog({
  open,
  onOpenChange,
  onSubmit,
  onCancel,
  contacts,
  probabilityValue,
  onProbabilityValueChange,
  submitting,
}: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" data-testid="button-new-deal">
          <Plus className="mr-2 h-4 w-4" />
          {t("pipeline.newDeal")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{t("pipeline.newDeal")}</DialogTitle>
            <DialogDescription>{t("pipeline.noDeals")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">{t("pipeline.dealTitle")}</Label>
              <Input
                id="title"
                name="title"
                placeholder={t("pipeline.dealTitlePlaceholder")}
                required
                data-testid="input-deal-title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="value">{t("pipeline.dealValue")} (R$)</Label>
              <Input id="value" name="value" type="number" placeholder="10000" data-testid="input-deal-value" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactId">
                {t("pipeline.contact")} ({t("common.optional")})
              </Label>
              <select
                id="contactId"
                name="contactId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="select-deal-contact"
              >
                <option value="">{t("common.search")}...</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="probability">{t("pipeline.probability")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="probability"
                    name="probability"
                    type="range"
                    min="0"
                    max="100"
                    value={probabilityValue}
                    onChange={(event) => onProbabilityValueChange(Number(event.target.value))}
                    className="h-2"
                    data-testid="input-deal-probability"
                  />
                  <span className="w-10 text-right text-sm text-muted-foreground">{probabilityValue}%</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expectedCloseDate">{t("pipeline.expectedCloseDate")}</Label>
                <Input id="expectedCloseDate" name="expectedCloseDate" type="date" data-testid="input-deal-expectedCloseDate" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="source">{t("contacts.source")}</Label>
              <Input id="source" name="source" placeholder={t("pipeline.sourcePlaceholder")} data-testid="input-deal-source" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">{t("common.notes")}</Label>
              <Textarea id="notes" name="notes" placeholder={t("common.description")} data-testid="input-deal-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting} data-testid="button-create-deal-submit">
              {submitting ? t("common.saving") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

