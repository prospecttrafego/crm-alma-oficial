/**
 * Email Template Create/Edit Dialog
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { emailTemplatesApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { EmailTemplate } from "@shared/schema";

type Translator = (key: string, params?: Record<string, string | number>) => string;

const createTemplateFormSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t("validation.required")),
    subject: z.string().min(1, t("validation.required")),
    body: z.string().min(1, t("validation.required")),
    variables: z.array(z.string()).optional(),
  });

type TemplateFormData = z.infer<ReturnType<typeof createTemplateFormSchema>>;

const getAvailableVariables = (t: Translator) => [
  { key: "{{contact.firstName}}", description: t("settings.templates.variables.contactFirstName") },
  { key: "{{contact.lastName}}", description: t("settings.templates.variables.contactLastName") },
  { key: "{{contact.email}}", description: t("settings.templates.variables.contactEmail") },
  { key: "{{contact.phone}}", description: t("settings.templates.variables.contactPhone") },
  { key: "{{contact.jobTitle}}", description: t("settings.templates.variables.contactJobTitle") },
  { key: "{{deal.title}}", description: t("settings.templates.variables.dealTitle") },
  { key: "{{deal.value}}", description: t("settings.templates.variables.dealValue") },
  { key: "{{company.name}}", description: t("settings.templates.variables.companyName") },
  { key: "{{user.firstName}}", description: t("settings.templates.variables.userFirstName") },
  { key: "{{user.lastName}}", description: t("settings.templates.variables.userLastName") },
];

interface EmailTemplateDialogProps {
  template?: EmailTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailTemplateDialog({ template, open, onOpenChange }: EmailTemplateDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isEditing = !!template;
  const formSchema = createTemplateFormSchema(t);
  const availableVariables = getAvailableVariables(t);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: template?.name || "",
      subject: template?.subject || "",
      body: template?.body || "",
      variables: template?.variables || [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      await emailTemplatesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: t("settings.templates.toast.created") });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: t("settings.templates.toast.createError"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      if (!template?.id) {
        throw new Error(t("errors.generic"));
      }
      await emailTemplatesApi.update(template.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: t("settings.templates.toast.updated") });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("settings.templates.toast.updateError"), variant: "destructive" });
    },
  });

  const onSubmit = (data: TemplateFormData) => {
    const variablesUsed = availableVariables
      .filter(v => data.body.includes(v.key) || data.subject.includes(v.key))
      .map(v => v.key);

    const submitData = { ...data, variables: variablesUsed };

    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const insertVariable = (variable: string) => {
    const currentBody = form.getValues("body");
    form.setValue("body", currentBody + variable);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("settings.templates.dialog.editTitle") : t("settings.templates.dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("settings.templates.subtitle")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.templates.templateName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("settings.templates.dialog.namePlaceholder")}
                      {...field}
                      data-testid="input-template-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.templates.subject")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("settings.templates.dialog.subjectPlaceholder")}
                      {...field}
                      data-testid="input-template-subject"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.templates.body")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("settings.templates.dialog.bodyPlaceholder")}
                      className="min-h-[150px]"
                      {...field}
                      data-testid="input-template-body"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {t("settings.templates.dialog.variablesTitle")}
              </Label>
              <div className="flex flex-wrap gap-2">
                {availableVariables.map((variable) => (
                  <Badge
                    key={variable.key}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => insertVariable(variable.key)}
                    data-testid={`button-insert-variable-${variable.key}`}
                  >
                    {variable.key}
                  </Badge>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-template"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-template"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t("common.saving")
                  : isEditing
                  ? t("common.update")
                  : t("settings.templates.newTemplate")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
