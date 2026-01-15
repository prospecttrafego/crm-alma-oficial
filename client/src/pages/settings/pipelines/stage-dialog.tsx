/**
 * Pipeline Stage Create/Edit Dialog
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
import { Switch } from "@/components/ui/switch";
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
import type { PipelineStage } from "@shared/schema";
import { STAGE_COLORS } from "./constants";

type Translator = (key: string, params?: Record<string, string | number>) => string;

const createStageFormSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t("validation.required")),
    color: z.string().min(1, t("validation.required")),
    isWon: z.boolean().default(false),
    isLost: z.boolean().default(false),
  });

type StageFormData = z.infer<ReturnType<typeof createStageFormSchema>>;

interface StageDialogProps {
  stage?: PipelineStage;
  pipelineId: number;
  stageCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StageDialog({
  stage,
  pipelineId,
  stageCount,
  open,
  onOpenChange,
}: StageDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isEditing = !!stage;
  const formSchema = createStageFormSchema(t);

  const form = useForm<StageFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      color: "#41B6E6",
      isWon: false,
      isLost: false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: stage?.name || "",
        color: stage?.color || "#41B6E6",
        isWon: stage?.isWon || false,
        isLost: stage?.isLost || false,
      });
    }
  }, [open, stage, form]);

  const createMutation = useMutation({
    mutationFn: async (data: StageFormData) => {
      await pipelinesApi.createStage(pipelineId, {
        ...data,
        order: stageCount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.stageCreated") });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: t("settings.pipelines.toast.stageCreateError"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StageFormData) => {
      if (!stage?.id) {
        throw new Error(t("errors.generic"));
      }
      await pipelinesApi.updateStage(pipelineId, stage.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.stageUpdated") });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("settings.pipelines.toast.stageUpdateError"), variant: "destructive" });
    },
  });

  const onSubmit = (data: StageFormData) => {
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
            {isEditing ? t("settings.pipelines.stageDialog.editTitle") : t("settings.pipelines.stageDialog.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t("settings.pipelines.stageDialog.editDescription") : t("settings.pipelines.stageDialog.addDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.pipelines.stageName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("settings.pipelines.stageDialog.namePlaceholder")}
                      {...field}
                      data-testid="input-stage-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.pipelines.stageColor")}</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {STAGE_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => field.onChange(color)}
                          className={`h-8 w-8 rounded-full border-2 transition-all ${
                            field.value === color ? "border-foreground scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          data-testid={`button-color-${color}`}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-6">
              <FormField
                control={form.control}
                name="isWon"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) form.setValue("isLost", false);
                        }}
                        data-testid="switch-is-won"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">{t("settings.pipelines.isWon")}</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isLost"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) form.setValue("isWon", false);
                        }}
                        data-testid="switch-is-lost"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">{t("settings.pipelines.isLost")}</FormLabel>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-stage"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-stage"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t("common.saving")
                  : isEditing
                  ? t("common.update")
                  : t("settings.pipelines.addStage")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
