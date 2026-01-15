import { useContactMutations } from "@/hooks/mutations";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

type NewContactDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewContactDialog({ open, onOpenChange }: NewContactDialogProps) {
  const { t } = useTranslation();
  const { createContact } = useContactMutations();

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
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" data-testid="button-new-contact">
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
                <Input id="firstName" name="firstName" required data-testid="input-contact-firstName" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">{t("contacts.lastName")}</Label>
                <Input id="lastName" name="lastName" data-testid="input-contact-lastName" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">{t("contacts.email")}</Label>
              <Input id="email" name="email" type="email" data-testid="input-contact-email" />
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createContact.isPending} data-testid="button-create-contact-submit">
              {createContact.isPending ? t("common.saving") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

