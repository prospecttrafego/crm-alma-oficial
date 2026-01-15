/**
 * Email Templates Section
 * Manages email templates for quick responses
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { emailTemplatesApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Mail, Plus, Pencil, Trash2, FileText, Copy } from "lucide-react";
import type { EmailTemplate } from "@shared/schema";
import { EmailTemplateDialog } from "./email-template-dialog";

export function EmailTemplatesSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>();

  const { data: templates, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
    queryFn: emailTemplatesApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await emailTemplatesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: t("settings.templates.toast.deleted") });
    },
    onError: () => {
      toast({ title: t("settings.templates.toast.deleteError"), variant: "destructive" });
    },
  });

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(undefined);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTemplate(undefined);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("toast.copied") });
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.templates.title")}</CardTitle>
          </div>
          <Button onClick={handleCreate} data-testid="button-create-template">
            <Plus className="h-4 w-4 mr-2" />
            {t("settings.templates.newTemplate")}
          </Button>
        </div>
        <CardDescription>{t("settings.templates.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((template) => (
              <TemplateItem
                key={template.id}
                template={template}
                onEdit={() => handleEdit(template)}
                onDelete={() => deleteMutation.mutate(template.id)}
                onCopy={() => copyToClipboard(template.body)}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("settings.templates.noTemplates")}</p>
            <p className="text-sm">{t("settings.templates.noTemplatesDescription")}</p>
          </div>
        )}
      </CardContent>
      <EmailTemplateDialog
        template={editingTemplate}
        open={dialogOpen}
        onOpenChange={handleDialogChange}
      />
    </Card>
  );
}

interface TemplateItemProps {
  template: EmailTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function TemplateItem({ template, onEdit, onDelete, onCopy, t }: TemplateItemProps) {
  return (
    <div
      className="flex items-start justify-between gap-4 p-4 rounded-md border bg-card"
      data-testid={`template-item-${template.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <h4 className="font-medium truncate" data-testid={`text-template-name-${template.id}`}>
            {template.name}
          </h4>
        </div>
        <p
          className="text-sm text-muted-foreground mt-1 truncate"
          data-testid={`text-template-subject-${template.id}`}
        >
          {t("settings.templates.subject")}: {template.subject}
        </p>
        {template.variables && template.variables.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {template.variables.map((variable) => (
              <Badge key={variable} variant="outline" className="text-xs">
                {variable}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          onClick={onCopy}
          data-testid={`button-copy-template-${template.id}`}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          data-testid={`button-edit-template-${template.id}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              data-testid={`button-delete-template-${template.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.templates.deleteTemplate")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings.templates.deleteTemplateDescription", { name: template.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} data-testid="button-confirm-delete">
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
