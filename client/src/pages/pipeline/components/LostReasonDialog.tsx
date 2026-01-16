import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/contexts/LanguageContext";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
  confirming: boolean;
};

export function LostReasonDialog({
  open,
  onOpenChange,
  value,
  onChange,
  onCancel,
  onConfirm,
  confirmDisabled,
  confirming,
}: Props) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("pipeline.lostReasonTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("pipeline.lostReasonDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="lostReason">
            {t("pipeline.lostReason")} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="lostReason"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t("pipeline.lostReasonPlaceholder")}
            className="mt-2"
            rows={3}
            required
          />
          {value.trim() === "" && <p className="mt-1 text-xs text-muted-foreground">{t("pipeline.lostReasonRequired")}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={confirmDisabled}>
            {confirming ? t("common.saving") : t("common.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

