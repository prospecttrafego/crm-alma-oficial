/**
 * Pipeline Create/Edit Dialog
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { pipelinesApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { PipelineWithStages } from "@shared/types";

type Translator = (key: string, params?: Record<string, string | number>) => string;

const createPipelineFormSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t("validation.required")),
  });

type PipelineFormData = z.infer<ReturnType<typeof createPipelineFormSchema>>;

interface PipelineDialogProps {
  pipeline?: PipelineWithStages;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PipelineDialog({ pipeline, open, onOpenChange }: PipelineDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isEditing = !!pipeline;
  const formSchema = createPipelineFormSchema(t);

  const form = useForm<PipelineFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: pipeline?.name || "",
      });
    }
  }, [open, pipeline, form]);

  const createMutation = useMutation({
    mutationFn: async (data: PipelineFormData) => {
      const defaultStages = [
        { name: t("settings.pipelines.defaultStages.lead"), order: 0, color: "#41B6E6", isWon: false, isLost: false },
        { name: t("settings.pipelines.defaultStages.qualified"), order: 1, color: "#22C55E", isWon: false, isLost: false },
        { name: t("settings.pipelines.defaultStages.proposal"), order: 2, color: "#F59E0B", isWon: false, isLost: false },
        { name: t("settings.pipelines.defaultStages.won"), order: 3, color: "#22C55E", isWon: true, isLost: false },
        { name: t("settings.pipelines.defaultStages.lost"), order: 4, color: "#EF4444", isWon: false, isLost: true },
      ];
      await pipelinesApi.create({ ...data, stages: defaultStages });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.created") });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: t("settings.pipelines.toast.createError"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PipelineFormData) => {
      if (!pipeline?.id) {
        throw new Error(t("errors.generic"));
      }
      await pipelinesApi.update(pipeline.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.updated") });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("settings.pipelines.toast.updateError"), variant: "destructive" });
    },
  });

  const onSubmit = (data: PipelineFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("settings.pipelines.dialog.editTitle") : t("settings.pipelines.dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t("settings.pipelines.dialog.editDescription") : t("settings.pipelines.dialog.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.pipelines.pipelineName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("settings.pipelines.dialog.namePlaceholder")}
                      {...field}
                      data-testid="input-pipeline-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-pipeline"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-pipeline"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t("common.saving")
                  : isEditing
                  ? t("common.update")
                  : t("settings.pipelines.createPipelineAction")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
