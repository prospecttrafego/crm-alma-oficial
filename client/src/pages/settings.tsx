import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  authApi,
  calendarEventsApi,
  channelConfigsApi,
  emailTemplatesApi,
  pipelinesApi,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUpload } from "@/components/avatar-upload";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
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
import { User, Bell, Palette, Shield, LogOut, Mail, Plus, Pencil, Trash2, FileText, Copy, GitBranch, Star, GripVertical, MessageSquare, CheckCircle, Loader2, BellRing, BellOff, Languages, Wifi, WifiOff, QrCode, Calendar, RefreshCw, Unplug, Link2 } from "lucide-react";
import { WhatsAppQRModal } from "@/components/whatsapp-qr-modal";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useTranslation, languageLabels, languages } from "@/contexts/LanguageContext";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmailTemplate, PipelineStage, ChannelConfig } from "@shared/schema";
import type { CreateChannelConfigDTO, UpdateChannelConfigDTO } from "@shared/types";
import type { PipelineWithStages } from "@/lib/api/pipelines";
import type { GoogleCalendarStatus } from "@/lib/api/calendarEvents";

type Translator = (key: string, params?: Record<string, string | number>) => string;

const createPipelineFormSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t("validation.required")),
  });

type PipelineFormData = z.infer<ReturnType<typeof createPipelineFormSchema>>;

const createStageFormSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t("validation.required")),
    color: z.string().min(1, t("validation.required")),
    isWon: z.boolean().default(false),
    isLost: z.boolean().default(false),
  });

type StageFormData = z.infer<ReturnType<typeof createStageFormSchema>>;

const STAGE_COLORS = [
  "#41B6E6", // Action Cyan
  "#041E42", // Brand Navy
  "#14B8A6", // Teal
  "#22C55E", // Success
  "#F59E0B", // Warning
  "#EF4444", // Danger
  "#0EA5E9", // Sky
  "#64748B", // Slate
];

function PipelineDialog({ 
  pipeline, 
  open, 
  onOpenChange 
}: { 
  pipeline?: PipelineWithStages; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
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

function StageDialog({ 
  stage,
  pipelineId,
  stageCount,
  open, 
  onOpenChange 
}: { 
  stage?: PipelineStage;
  pipelineId: number;
  stageCount: number;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
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

function PipelineManagementSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<PipelineWithStages | undefined>();
  const [editingStage, setEditingStage] = useState<PipelineStage | undefined>();
  const [selectedPipelineForStage, setSelectedPipelineForStage] = useState<PipelineWithStages | undefined>();
  const [expandedPipeline, setExpandedPipeline] = useState<number | null>(null);

  const { data: pipelines, isLoading } = useQuery<PipelineWithStages[]>({
    queryKey: ["/api/pipelines"],
    queryFn: pipelinesApi.list,
  });

  const deletePipelineMutation = useMutation({
    mutationFn: async (id: number) => {
      await pipelinesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.deleted") });
    },
    onError: (error: Error) => {
      toast({ title: error.message || t("settings.pipelines.toast.deleteError"), variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      await pipelinesApi.setDefault(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.defaultUpdated") });
    },
    onError: () => {
      toast({ title: t("settings.pipelines.toast.defaultError"), variant: "destructive" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async ({ pipelineId, stageId }: { pipelineId: number; stageId: number }) => {
      await pipelinesApi.deleteStage(pipelineId, stageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.stageDeleted") });
    },
    onError: () => {
      toast({ title: t("settings.pipelines.toast.stageDeleteError"), variant: "destructive" });
    },
  });

  const handleCreatePipeline = () => {
    setEditingPipeline(undefined);
    setPipelineDialogOpen(true);
  };

  const handleEditPipeline = (pipeline: PipelineWithStages) => {
    setEditingPipeline(pipeline);
    setPipelineDialogOpen(true);
  };

  const handleAddStage = (pipeline: PipelineWithStages) => {
    setSelectedPipelineForStage(pipeline);
    setEditingStage(undefined);
    setStageDialogOpen(true);
  };

  const handleEditStage = (pipeline: PipelineWithStages, stage: PipelineStage) => {
    setSelectedPipelineForStage(pipeline);
    setEditingStage(stage);
    setStageDialogOpen(true);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.pipelines.title")}</CardTitle>
          </div>
          <Button onClick={handleCreatePipeline} data-testid="button-create-pipeline">
            <Plus className="h-4 w-4 mr-2" />
            {t("settings.pipelines.newPipeline")}
          </Button>
        </div>
        <CardDescription>{t("settings.pipelines.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : pipelines && pipelines.length > 0 ? (
          <div className="space-y-4">
            {pipelines.map((pipeline) => (
              <div
                key={pipeline.id}
                className="rounded-md border"
                data-testid={`pipeline-item-${pipeline.id}`}
              >
                <div className="flex items-center justify-between gap-4 p-4">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => setExpandedPipeline(expandedPipeline === pipeline.id ? null : pipeline.id)}
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium" data-testid={`text-pipeline-name-${pipeline.id}`}>
                        {pipeline.name}
                      </h4>
                      {pipeline.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          {t("settings.pipelines.default")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {pipeline.stages?.length || 0} {t("settings.pipelines.stages").toLowerCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!pipeline.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDefaultMutation.mutate(pipeline.id)}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`button-set-default-${pipeline.id}`}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditPipeline(pipeline)}
                      data-testid={`button-edit-pipeline-${pipeline.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!pipeline.isDefault && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`button-delete-pipeline-${pipeline.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("settings.pipelines.deletePipeline")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("settings.pipelines.deletePipelineDescription", { name: pipeline.name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deletePipelineMutation.mutate(pipeline.id)}
                            >
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {expandedPipeline === pipeline.id && (
                  <div className="border-t p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">{t("settings.pipelines.stages")}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddStage(pipeline)}
                        data-testid={`button-add-stage-${pipeline.id}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {t("settings.pipelines.addStage")}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {pipeline.stages?.sort((a, b) => a.order - b.order).map((stage) => (
                        <div
                          key={stage.id}
                          className="flex items-center justify-between gap-3 p-2 rounded-md bg-background border"
                          data-testid={`stage-item-${stage.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: stage.color || "hsl(var(--primary))" }}
                            />
                            <span className="text-sm font-medium">{stage.name}</span>
                            {stage.isWon && (
                              <Badge variant="outline" className="text-xs text-green-600">{t("settings.pipelines.isWon")}</Badge>
                            )}
                            {stage.isLost && (
                              <Badge variant="outline" className="text-xs text-red-600">{t("settings.pipelines.isLost")}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditStage(pipeline, stage)}
                              data-testid={`button-edit-stage-${stage.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  data-testid={`button-delete-stage-${stage.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("settings.pipelines.deletePipeline")}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("settings.pipelines.deletePipelineDescription", { name: stage.name })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteStageMutation.mutate({
                                      pipelineId: pipeline.id,
                                      stageId: stage.id
                                    })}
                                  >
                                    {t("common.delete")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("settings.pipelines.noPipelines")}</p>
            <p className="text-sm">{t("settings.pipelines.noPipelinesDescription")}</p>
          </div>
        )}
      </CardContent>
      <PipelineDialog 
        pipeline={editingPipeline} 
        open={pipelineDialogOpen} 
        onOpenChange={(open) => {
          setPipelineDialogOpen(open);
          if (!open) setEditingPipeline(undefined);
        }} 
      />
      {selectedPipelineForStage && (
        <StageDialog 
          stage={editingStage}
          pipelineId={selectedPipelineForStage.id}
          stageCount={selectedPipelineForStage.stages?.length || 0}
          open={stageDialogOpen} 
          onOpenChange={(open) => {
            setStageDialogOpen(open);
            if (!open) {
              setEditingStage(undefined);
              setSelectedPipelineForStage(undefined);
            }
          }} 
        />
      )}
    </Card>
  );
}

const createEmailConfigSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t("validation.required")),
    imapHost: z.string().min(1, t("validation.required")),
    imapPort: z.coerce.number().min(1, t("validation.required")),
    imapSecure: z.boolean().default(true),
    smtpHost: z.string().min(1, t("validation.required")),
    smtpPort: z.coerce.number().min(1, t("validation.required")),
    smtpSecure: z.boolean().default(true),
    email: z.string().email(t("validation.invalidEmail")),
    password: z.string().optional(),
    fromName: z.string().optional(),
  });

const createEmailConfigCreateSchema = (t: Translator) =>
  createEmailConfigSchema(t).extend({
    password: z.string().min(1, t("validation.required")),
  });

// Evolution API WhatsApp config (simpler - just name, connection handled via QR)
const createWhatsappConfigSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t("validation.required")),
  });

type EmailConfigFormData = z.infer<ReturnType<typeof createEmailConfigSchema>>;
type WhatsappConfigFormData = z.infer<ReturnType<typeof createWhatsappConfigSchema>>;

function ChannelConfigDialog({
  config,
  channelType,
  open,
  onOpenChange,
}: {
  config?: ChannelConfig;
  channelType: "email" | "whatsapp";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isEditing = !!config;
  const emailSchema = createEmailConfigSchema(t);
  const emailCreateSchema = createEmailConfigCreateSchema(t);
  const whatsappSchema = createWhatsappConfigSchema(t);

  const emailForm = useForm<EmailConfigFormData>({
    resolver: zodResolver(isEditing ? emailSchema : emailCreateSchema),
    defaultValues: {
      name: "",
      imapHost: "",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "",
      smtpPort: 587,
      smtpSecure: true,
      email: "",
      password: "",
      fromName: "",
    },
  });

  const whatsappForm = useForm<WhatsappConfigFormData>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: {
      name: "",
    },
  });

  const [qrModalOpen, setQrModalOpen] = useState(false);

  const hasExistingPassword = config?.type === "email" &&
    (config.emailConfig as Record<string, unknown>)?.hasPassword === true;

  // Get WhatsApp connection status
  const whatsappConfig = config?.type === "whatsapp" ? config.whatsappConfig as Record<string, unknown> : null;
  const connectionStatus = whatsappConfig?.connectionStatus as string || "disconnected";
  const instanceName = whatsappConfig?.instanceName as string | undefined;
  const dialogTitle = channelType === "email"
    ? (isEditing ? t("settings.channels.dialog.editEmailTitle") : t("settings.channels.dialog.addEmailTitle"))
    : (isEditing ? t("settings.channels.dialog.editWhatsappTitle") : t("settings.channels.dialog.addWhatsappTitle"));
  const dialogDescription = channelType === "email"
    ? t("settings.channels.dialog.emailDescription")
    : t("settings.channels.dialog.whatsappDescription");

  useEffect(() => {
    if (open && config) {
      if (config.type === "email" && config.emailConfig) {
        const ec = config.emailConfig as Record<string, unknown>;
        emailForm.reset({
          name: config.name,
          imapHost: (ec.imapHost as string) || "",
          imapPort: (ec.imapPort as number) || 993,
          imapSecure: (ec.imapSecure as boolean) ?? true,
          smtpHost: (ec.smtpHost as string) || "",
          smtpPort: (ec.smtpPort as number) || 587,
          smtpSecure: (ec.smtpSecure as boolean) ?? true,
          email: (ec.email as string) || "",
          password: "",
          fromName: (ec.fromName as string) || "",
        });
      } else if (config.type === "whatsapp") {
        whatsappForm.reset({
          name: config.name,
        });
      }
    } else if (open && !config) {
      emailForm.reset({
        name: "",
        imapHost: "",
        imapPort: 993,
        imapSecure: true,
        smtpHost: "",
        smtpPort: 587,
        smtpSecure: true,
        email: "",
        password: "",
        fromName: "",
      });
      whatsappForm.reset({
        name: "",
      });
    }
  }, [open, config, emailForm, whatsappForm]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateChannelConfigDTO) => {
      await channelConfigsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("settings.channels.toast.created") });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("settings.channels.toast.createError"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateChannelConfigDTO) => {
      if (!config?.id) {
        throw new Error(t("errors.generic"));
      }
      await channelConfigsApi.update(config.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("settings.channels.toast.updated") });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("settings.channels.toast.updateError"), variant: "destructive" });
    },
  });

  const onEmailSubmit = (data: EmailConfigFormData) => {
    const emailConfig: NonNullable<CreateChannelConfigDTO["emailConfig"]> = {
      imapHost: data.imapHost,
      imapPort: data.imapPort,
      imapSecure: data.imapSecure,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      email: data.email,
      fromName: data.fromName,
      password: data.password ?? "",
    };
    const payload: CreateChannelConfigDTO = {
      type: "email",
      name: data.name,
      emailConfig,
    };
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const onWhatsappSubmit = (data: WhatsappConfigFormData) => {
    const payload: CreateChannelConfigDTO = {
      type: "whatsapp",
      name: data.name,
      whatsappConfig: {},
    };
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  // Disconnect WhatsApp mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!config?.id) throw new Error(t("errors.generic"));
      await channelConfigsApi.disconnectWhatsApp(config.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("settings.channels.whatsapp.disconnectSuccess") });
    },
    onError: () => {
      toast({ title: t("settings.channels.whatsapp.disconnectError"), variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {channelType === "email" ? (
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.channels.configName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("settings.channels.email.configNamePlaceholder")} {...field} data-testid="input-email-config-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={emailForm.control}
                  name="imapHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("settings.channels.email.imapHost")}</FormLabel>
                      <FormControl>
                        <Input placeholder="imap.gmail.com" {...field} data-testid="input-imap-host" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="imapPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("settings.channels.email.imapPort")}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-imap-port" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={emailForm.control}
                name="imapSecure"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-imap-secure" />
                    </FormControl>
                    <FormLabel className="!mt-0">{t("settings.channels.email.imapSecure")}</FormLabel>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={emailForm.control}
                  name="smtpHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("settings.channels.email.smtpHost")}</FormLabel>
                      <FormControl>
                        <Input placeholder="smtp.gmail.com" {...field} data-testid="input-smtp-host" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="smtpPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("settings.channels.email.smtpPort")}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-smtp-port" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={emailForm.control}
                name="smtpSecure"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-smtp-secure" />
                    </FormControl>
                    <FormLabel className="!mt-0">{t("settings.channels.email.smtpSecure")}</FormLabel>
                  </FormItem>
                )}
              />
              <Separator />
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.channels.email.emailAddress")}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="support@company.com" {...field} data-testid="input-email-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={emailForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("settings.channels.email.passwordLabel")}
                      {isEditing && hasExistingPassword && (
                        <span className="text-muted-foreground ml-2 font-normal">{t("settings.channels.email.passwordKeep")}</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder={
                          hasExistingPassword
                            ? t("settings.channels.email.passwordPlaceholderUpdate")
                            : t("settings.channels.email.passwordPlaceholderNew")
                        } 
                        {...field} 
                        data-testid="input-email-password" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={emailForm.control}
                name="fromName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.channels.email.fromNameOptional")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("settings.channels.email.fromNamePlaceholder")} {...field} data-testid="input-from-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-channel">
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-channel">
                  {createMutation.isPending || updateMutation.isPending
                    ? t("common.saving")
                    : isEditing
                    ? t("common.update")
                    : t("settings.channels.addChannel")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <Form {...whatsappForm}>
            <form onSubmit={whatsappForm.handleSubmit(onWhatsappSubmit)} className="space-y-4">
              <FormField
                control={whatsappForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.channels.configName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("settings.channels.whatsapp.configNamePlaceholder")} {...field} data-testid="input-whatsapp-config-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Connection Status (only shown when editing) */}
              {isEditing && (
                <div className="space-y-4">
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">{t("settings.channels.whatsapp.connectionStatus")}</Label>
                      <div className="flex items-center gap-2">
                        {connectionStatus === "connected" ? (
                          <>
                            <Wifi className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">{t("settings.channels.whatsapp.connected")}</span>
                          </>
                        ) : connectionStatus === "connecting" || connectionStatus === "qr_pending" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                            <span className="text-sm text-amber-600 font-medium">
                              {connectionStatus === "qr_pending"
                                ? t("settings.channels.whatsapp.waitingQr")
                                : t("settings.channels.whatsapp.connecting")}
                            </span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{t("settings.channels.whatsapp.disconnected")}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {connectionStatus === "connected" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => disconnectMutation.mutate()}
                          disabled={disconnectMutation.isPending}
                        >
                          {disconnectMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <WifiOff className="h-4 w-4 mr-2" />
                          )}
                          {t("settings.channels.whatsapp.disconnect")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQrModalOpen(true)}
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          {t("settings.channels.whatsapp.connect")}
                        </Button>
                      )}
                    </div>
                  </div>
                  {instanceName && (
                    <p className="text-xs text-muted-foreground">
                      {t("settings.channels.whatsapp.instance")}: {instanceName}
                    </p>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-whatsapp">
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-whatsapp">
                  {createMutation.isPending || updateMutation.isPending
                    ? t("common.saving")
                    : isEditing
                    ? t("common.update")
                    : t("common.add")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* WhatsApp QR Modal */}
        {config?.id && (
          <WhatsAppQRModal
            open={qrModalOpen}
            onOpenChange={setQrModalOpen}
            channelConfigId={config.id}
            onConnected={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
              setQrModalOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// INTEGRATIONS SECTION (Google Calendar, Email, WhatsApp)
// =============================================

function IntegrationsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [channelType, setChannelType] = useState<"email" | "whatsapp">("email");
  const [editingConfig, setEditingConfig] = useState<ChannelConfig | undefined>();
  const [testingId, setTestingId] = useState<number | null>(null);

  // Channel configs (Email & WhatsApp)
  const { data: configs } = useQuery<ChannelConfig[]>({
    queryKey: ["/api/channel-configs"],
    queryFn: channelConfigsApi.list,
  });

  // Google Calendar status
  const { data: gcConfigStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/integrations/google-calendar/configured"],
    queryFn: calendarEventsApi.getGoogleCalendarConfigured,
  });

  const { data: gcStatus, refetch: refetchGcStatus } = useQuery<GoogleCalendarStatus>({
    queryKey: ["/api/integrations/google-calendar/status"],
    queryFn: calendarEventsApi.getGoogleCalendarStatus,
    enabled: gcConfigStatus?.configured,
    refetchInterval: 30000,
  });

  // Google Calendar mutations
  const gcConnectMutation = useMutation({
    mutationFn: async () => {
      const data = await calendarEventsApi.authorizeGoogleCalendar();
      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: () => {
      toast({ title: t("settings.googleCalendar.toast.connectError"), variant: "destructive" });
    },
  });

  const gcDisconnectMutation = useMutation({
    mutationFn: async () => {
      await calendarEventsApi.disconnectGoogleCalendar();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google-calendar/status"] });
      toast({ title: t("settings.googleCalendar.toast.disconnected") });
    },
    onError: () => {
      toast({ title: t("settings.googleCalendar.toast.disconnectError"), variant: "destructive" });
    },
  });

  const gcSyncMutation = useMutation({
    mutationFn: async () => {
      return calendarEventsApi.syncGoogleCalendar();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google-calendar/status"] });
      toast({ title: t("settings.googleCalendar.toast.syncSuccess", { count: data.imported || 0 }) });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google-calendar/status"] });
      toast({ title: t("settings.googleCalendar.toast.syncError"), variant: "destructive" });
    },
  });

  // Check for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcResult = params.get("google_calendar");
    if (gcResult === "success") {
      toast({ title: t("settings.googleCalendar.toast.connected") });
      const url = new URL(window.location.href);
      url.searchParams.delete("google_calendar");
      window.history.replaceState({}, "", url.pathname);
      refetchGcStatus();
    } else if (gcResult === "error") {
      const message = params.get("message");
      toast({ title: t("settings.googleCalendar.toast.connectError"), description: message || undefined, variant: "destructive" });
      const url = new URL(window.location.href);
      url.searchParams.delete("google_calendar");
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [toast, t, refetchGcStatus]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await channelConfigsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: t("settings.channels.toast.deleted") });
    },
    onError: () => {
      toast({ title: t("settings.channels.toast.deleteError"), variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      setTestingId(id);
      return channelConfigsApi.testConnection(id);
    },
    onSuccess: (data) => {
      setTestingId(null);
      toast({ title: data.message || t("settings.channels.toast.testSuccess") });
    },
    onError: () => {
      setTestingId(null);
      toast({ title: t("settings.channels.toast.testError"), variant: "destructive" });
    },
  });

  const handleCreate = (type: "email" | "whatsapp") => {
    setChannelType(type);
    setEditingConfig(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (config: ChannelConfig) => {
    setChannelType(config.type as "email" | "whatsapp");
    setEditingConfig(config);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingConfig(undefined);
    }
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <CardTitle>{t("settings.integrations.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.integrations.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Google Calendar Integration */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-md bg-red-500/10">
              <Calendar className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium">{t("settings.googleCalendar.title")}</h4>
                {gcStatus?.connected ? (
                  <Badge variant="outline" className="text-green-600 border-green-600 text-xs gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {t("settings.integrations.connected")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {t("settings.integrations.notConnected")}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {gcStatus?.connected
                  ? gcStatus.email
                  : t("settings.googleCalendar.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {gcStatus?.connected ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => gcSyncMutation.mutate()}
                  disabled={gcSyncMutation.isPending || gcStatus.syncStatus === "syncing"}
                  title={t("settings.googleCalendar.syncNow")}
                >
                  {gcSyncMutation.isPending || gcStatus.syncStatus === "syncing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" title={t("settings.googleCalendar.disconnect")}>
                      <Unplug className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("settings.googleCalendar.disconnectConfirm.title")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("settings.googleCalendar.disconnectConfirm.description")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => gcDisconnectMutation.mutate()}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {t("settings.googleCalendar.disconnect")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => gcConnectMutation.mutate()}
                disabled={gcConnectMutation.isPending}
              >
                {gcConnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {t("settings.integrations.connect")}
              </Button>
            )}
          </div>
        </div>

        {/* Email Integration */}
        {(() => {
          const emailConfigs = configs?.filter(c => c.type === "email") || [];
          const hasEmail = emailConfigs.length > 0;
          const firstEmail = emailConfigs[0];
          return (
            <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-md bg-blue-500/10">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">E-mail</h4>
                    {hasEmail ? (
                      <Badge variant="outline" className="text-green-600 border-green-600 text-xs gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {t("settings.integrations.connected")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {t("settings.integrations.notConnected")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {hasEmail
                      ? String((firstEmail?.emailConfig as Record<string, unknown>)?.email || "")
                      : t("settings.channels.dialog.emailDescription")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasEmail ? (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => testMutation.mutate(firstEmail!.id)}
                      disabled={testingId === firstEmail!.id}
                      title="Testar conexão"
                    >
                      {testingId === firstEmail!.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(firstEmail!)} title={t("common.edit")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title={t("common.delete")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("settings.channels.deleteChannel")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("settings.channels.deleteChannelDescription", { name: firstEmail!.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(firstEmail!.id)}>{t("common.delete")}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => handleCreate("email")}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("settings.integrations.connect")}
                  </Button>
                )}
              </div>
            </div>
          );
        })()}

        {/* WhatsApp Integration */}
        {(() => {
          const whatsappConfigs = configs?.filter(c => c.type === "whatsapp") || [];
          const hasWhatsapp = whatsappConfigs.length > 0;
          const firstWhatsapp = whatsappConfigs[0];
          const wc = firstWhatsapp?.whatsappConfig as Record<string, unknown> | null;
          const connectionStatus = wc?.connectionStatus as string | undefined;
          return (
            <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-md bg-green-500/10">
                  <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">WhatsApp</h4>
                    {hasWhatsapp ? (
                      connectionStatus === "connected" ? (
                        <Badge variant="outline" className="text-green-600 border-green-600 text-xs gap-1">
                          <Wifi className="h-3 w-3" />
                          {t("settings.channels.whatsapp.connected")}
                        </Badge>
                      ) : connectionStatus === "connecting" || connectionStatus === "qr_pending" ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {connectionStatus === "qr_pending" ? t("settings.channels.whatsapp.waitingQr") : t("settings.channels.whatsapp.connecting")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {t("settings.channels.whatsapp.disconnected")}
                        </Badge>
                      )
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {t("settings.integrations.notConnected")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {hasWhatsapp
                      ? connectionStatus === "connected"
                        ? t("settings.channels.whatsapp.connectedVia")
                        : connectionStatus === "qr_pending"
                          ? t("settings.channels.whatsapp.waitingQrScan")
                          : t("settings.channels.whatsapp.viaEvolution")
                      : t("settings.channels.dialog.whatsappDescription")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasWhatsapp ? (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => testMutation.mutate(firstWhatsapp!.id)}
                      disabled={testingId === firstWhatsapp!.id}
                      title="Testar conexão"
                    >
                      {testingId === firstWhatsapp!.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(firstWhatsapp!)} title={t("common.edit")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title={t("common.delete")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("settings.channels.deleteChannel")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("settings.channels.deleteChannelDescription", { name: firstWhatsapp!.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(firstWhatsapp!.id)}>{t("common.delete")}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => handleCreate("whatsapp")}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("settings.integrations.connect")}
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </CardContent>
      <ChannelConfigDialog key={editingConfig?.id ?? 'new'} config={editingConfig} channelType={channelType} open={dialogOpen} onOpenChange={handleDialogChange} />
    </Card>
  );
}

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

function EmailTemplateDialog({ 
  template, 
  open, 
  onOpenChange 
}: { 
  template?: EmailTemplate; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
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
          <DialogTitle>{isEditing ? t("settings.templates.dialog.editTitle") : t("settings.templates.dialog.createTitle")}</DialogTitle>
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
              <Label className="text-sm text-muted-foreground">{t("settings.templates.dialog.variablesTitle")}</Label>
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

function EmailTemplatesSection() {
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
              <div
                key={template.id}
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
                  <p className="text-sm text-muted-foreground mt-1 truncate" data-testid={`text-template-subject-${template.id}`}>
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
                    onClick={() => copyToClipboard(template.body)}
                    data-testid={`button-copy-template-${template.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(template)}
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
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(template.id)}
                          data-testid="button-confirm-delete"
                        >
                          {t("common.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
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

function NotificationsCard() {
  const { t } = useTranslation();
  const {
    isSupported,
    isEnabled,
    isLoading,
    permissionStatus,
    enableNotifications,
  } = usePushNotifications();

  const {
    isEnabled: soundEnabled,
    setEnabled: setSoundEnabled,
    playNotification,
  } = useNotificationSound();

  const [soundEnabledState, setSoundEnabledState] = useState(soundEnabled);

  // Sync state with hook
  useEffect(() => {
    setSoundEnabledState(soundEnabled);
  }, [soundEnabled]);

  const handleSoundToggle = (checked: boolean) => {
    setSoundEnabledState(checked);
    setSoundEnabled(checked);
    if (checked) {
      // Play a test sound when enabling
      playNotification();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>{t("settings.notifications.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.notifications.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("settings.notifications.email")}</p>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.emailDescription")}
              </p>
            </div>
            <Badge variant="secondary">{t("settings.notifications.comingSoon")}</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isEnabled ? (
                <BellRing className="h-5 w-5 text-green-500" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{t("settings.notifications.push")}</p>
                <p className="text-sm text-muted-foreground">
                  {!isSupported
                    ? t("settings.notifications.pushNotAvailable")
                    : permissionStatus === "denied"
                    ? t("settings.notifications.pushNotAvailable")
                    : isEnabled
                    ? t("settings.notifications.pushDescription")
                    : t("settings.notifications.pushDescription")}
                </p>
              </div>
            </div>
            {isSupported && permissionStatus !== "denied" && (
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    enableNotifications();
                  }
                }}
                disabled={isLoading || isEnabled}
                data-testid="switch-push-notifications"
              />
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("settings.notifications.sounds")}</p>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.soundsDescription")}
              </p>
            </div>
            <Switch
              checked={soundEnabledState}
              onCheckedChange={handleSoundToggle}
              data-testid="switch-notification-sounds"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t, isUpdating: isLanguageUpdating } = useTranslation();
  const roleKey = user?.role ? `roles.${user.role}` : "roles.unknown";
  const roleLabel = t(roleKey);
  const displayRole = roleLabel === roleKey ? (user?.role || t("roles.unknown")) : roleLabel;

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">{t("settings.title")}</h1>
        <p className="text-muted-foreground">
          {t("settings.profile.subtitle")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>{t("settings.profile.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.profile.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <AvatarUpload
                currentImageUrl={user?.profileImageUrl}
                fallback={getInitials()}
                size="md"
              />
              <div>
                <p className="font-semibold" data-testid="text-profile-name">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-profile-email">
                  {user?.email}
                </p>
                <Badge variant="secondary" className="mt-1 capitalize">
                  {displayRole}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">{t("settings.profile.firstName")}</Label>
                <Input
                  id="firstName"
                  defaultValue={user?.firstName || ""}
                  disabled
                  data-testid="input-settings-firstName"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">{t("settings.profile.lastName")}</Label>
                <Input
                  id="lastName"
                  defaultValue={user?.lastName || ""}
                  disabled
                  data-testid="input-settings-lastName"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t("settings.profile.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user?.email || ""}
                  disabled
                  data-testid="input-settings-email"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle>{t("settings.appearance.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.appearance.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("settings.appearance.theme")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.appearance.subtitle")}
                </p>
              </div>
              <ThemeToggle />
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="font-medium">{t("settings.appearance.theme")}</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                    theme === "light" ? "border-primary bg-accent" : "hover-elevate"
                  }`}
                  data-testid="button-theme-light"
                >
                  <div className="h-8 w-8 rounded-full bg-white border" />
                  <span className="text-sm">{t("settings.appearance.light")}</span>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                    theme === "dark" ? "border-primary bg-accent" : "hover-elevate"
                  }`}
                  data-testid="button-theme-dark"
                >
                  <div className="h-8 w-8 rounded-full bg-zinc-900 border" />
                  <span className="text-sm">{t("settings.appearance.dark")}</span>
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                    theme === "system" ? "border-primary bg-accent" : "hover-elevate"
                  }`}
                  data-testid="button-theme-system"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-white to-zinc-900 border" />
                  <span className="text-sm">{t("settings.appearance.system")}</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <NotificationsCard />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>{t("settings.account.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.account.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t("settings.account.language")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.account.languageDescription")}
                  </p>
                </div>
              </div>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as 'pt-BR' | 'en')}
                disabled={isLanguageUpdating}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-language">
                <SelectValue placeholder={t("settings.account.languagePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {languageLabels[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("settings.account.session")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.account.sessionDescription")}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleLogout}
                data-testid="button-settings-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("settings.account.signOut")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <PipelineManagementSection />

        <EmailTemplatesSection />

        <IntegrationsSection />
      </div>
    </div>
  );
}
