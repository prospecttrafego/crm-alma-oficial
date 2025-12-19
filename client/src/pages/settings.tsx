import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DialogTrigger,
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
import { User, Bell, Palette, Shield, LogOut, Mail, Plus, Pencil, Trash2, FileText, Copy, GitBranch, Star, GripVertical, MessageSquare, CheckCircle, XCircle, Loader2, BellRing, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmailTemplate, Pipeline, PipelineStage, ChannelConfig } from "@shared/schema";

interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[];
}

const pipelineFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type PipelineFormData = z.infer<typeof pipelineFormSchema>;

const stageFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().min(1, "Color is required"),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
});

type StageFormData = z.infer<typeof stageFormSchema>;

const STAGE_COLORS = [
  "#605be5", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#14b8a6"
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
  const { toast } = useToast();
  const isEditing = !!pipeline;

  const form = useForm<PipelineFormData>({
    resolver: zodResolver(pipelineFormSchema),
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
        { name: "Lead", order: 0, color: "#605be5", isWon: false, isLost: false },
        { name: "Qualified", order: 1, color: "#22c55e", isWon: false, isLost: false },
        { name: "Proposal", order: 2, color: "#f59e0b", isWon: false, isLost: false },
        { name: "Won", order: 3, color: "#22c55e", isWon: true, isLost: false },
        { name: "Lost", order: 4, color: "#ef4444", isWon: false, isLost: true },
      ];
      await apiRequest("POST", "/api/pipelines", { ...data, stages: defaultStages });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Pipeline created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create pipeline", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PipelineFormData) => {
      await apiRequest("PATCH", `/api/pipelines/${pipeline?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Pipeline updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update pipeline", variant: "destructive" });
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
          <DialogTitle>{isEditing ? "Edit Pipeline" : "Create Pipeline"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update pipeline details" : "Create a new sales pipeline with default stages"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pipeline Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Enterprise Sales, SMB Pipeline" 
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
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-pipeline"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update" : "Create Pipeline"}
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
  const { toast } = useToast();
  const isEditing = !!stage;

  const form = useForm<StageFormData>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: {
      name: "",
      color: "#605be5",
      isWon: false,
      isLost: false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: stage?.name || "",
        color: stage?.color || "#605be5",
        isWon: stage?.isWon || false,
        isLost: stage?.isLost || false,
      });
    }
  }, [open, stage, form]);

  const createMutation = useMutation({
    mutationFn: async (data: StageFormData) => {
      await apiRequest("POST", `/api/pipelines/${pipelineId}/stages`, { 
        ...data, 
        order: stageCount,
        pipelineId 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Stage added successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add stage", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StageFormData) => {
      await apiRequest("PATCH", `/api/pipelines/${pipelineId}/stages/${stage?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Stage updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update stage", variant: "destructive" });
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
          <DialogTitle>{isEditing ? "Edit Stage" : "Add Stage"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update stage details" : "Add a new stage to the pipeline"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Qualified, Proposal Sent" 
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
                  <FormLabel>Color</FormLabel>
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
                    <FormLabel className="!mt-0">Won Stage</FormLabel>
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
                    <FormLabel className="!mt-0">Lost Stage</FormLabel>
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
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-stage"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update" : "Add Stage"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PipelineManagementSection() {
  const { toast } = useToast();
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<PipelineWithStages | undefined>();
  const [editingStage, setEditingStage] = useState<PipelineStage | undefined>();
  const [selectedPipelineForStage, setSelectedPipelineForStage] = useState<PipelineWithStages | undefined>();
  const [expandedPipeline, setExpandedPipeline] = useState<number | null>(null);

  const { data: pipelines, isLoading } = useQuery<PipelineWithStages[]>({
    queryKey: ["/api/pipelines"],
  });

  const deletePipelineMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pipelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Pipeline deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to delete pipeline", variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/pipelines/${id}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Default pipeline updated" });
    },
    onError: () => {
      toast({ title: "Failed to set default pipeline", variant: "destructive" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async ({ pipelineId, stageId }: { pipelineId: number; stageId: number }) => {
      await apiRequest("DELETE", `/api/pipelines/${pipelineId}/stages/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Stage deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete stage", variant: "destructive" });
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
            <CardTitle>Sales Pipelines</CardTitle>
          </div>
          <Button onClick={handleCreatePipeline} data-testid="button-create-pipeline">
            <Plus className="h-4 w-4 mr-2" />
            New Pipeline
          </Button>
        </div>
        <CardDescription>Create and manage multiple sales pipelines with custom stages</CardDescription>
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
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {pipeline.stages?.length || 0} stages
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
                            <AlertDialogTitle>Delete Pipeline?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{pipeline.name}"? This will also delete all stages. Deals must be moved to another pipeline first.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deletePipelineMutation.mutate(pipeline.id)}
                            >
                              Delete
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
                      <p className="text-sm font-medium">Stages</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddStage(pipeline)}
                        data-testid={`button-add-stage-${pipeline.id}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Stage
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
                              style={{ backgroundColor: stage.color || "#605be5" }}
                            />
                            <span className="text-sm font-medium">{stage.name}</span>
                            {stage.isWon && (
                              <Badge variant="outline" className="text-xs text-green-600">Won</Badge>
                            )}
                            {stage.isLost && (
                              <Badge variant="outline" className="text-xs text-red-600">Lost</Badge>
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
                                  <AlertDialogTitle>Delete Stage?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{stage.name}"? Deals in this stage must be moved first.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteStageMutation.mutate({ 
                                      pipelineId: pipeline.id, 
                                      stageId: stage.id 
                                    })}
                                  >
                                    Delete
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
            <p>No pipelines yet</p>
            <p className="text-sm">Create your first pipeline to organize your sales process</p>
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

const emailConfigSchema = z.object({
  name: z.string().min(1, "Name is required"),
  imapHost: z.string().min(1, "IMAP host is required"),
  imapPort: z.coerce.number().min(1, "IMAP port is required"),
  imapSecure: z.boolean().default(true),
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.coerce.number().min(1, "SMTP port is required"),
  smtpSecure: z.boolean().default(true),
  email: z.string().email("Valid email is required"),
  password: z.string().optional(),
  fromName: z.string().optional(),
});

const emailConfigCreateSchema = emailConfigSchema.extend({
  password: z.string().min(1, "Password is required"),
});

const whatsappConfigSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumberId: z.string().min(1, "Phone Number ID is required"),
  accessToken: z.string().optional(),
  businessAccountId: z.string().min(1, "Business Account ID is required"),
  webhookVerifyToken: z.string().optional(),
});

const whatsappConfigCreateSchema = whatsappConfigSchema.extend({
  accessToken: z.string().min(1, "Access Token is required"),
});

type EmailConfigFormData = z.infer<typeof emailConfigSchema>;
type WhatsappConfigFormData = z.infer<typeof whatsappConfigSchema>;

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
  const { toast } = useToast();
  const isEditing = !!config;

  const emailForm = useForm<EmailConfigFormData>({
    resolver: zodResolver(isEditing ? emailConfigSchema : emailConfigCreateSchema),
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
    resolver: zodResolver(isEditing ? whatsappConfigSchema : whatsappConfigCreateSchema),
    defaultValues: {
      name: "",
      phoneNumberId: "",
      accessToken: "",
      businessAccountId: "",
      webhookVerifyToken: "",
    },
  });

  const hasExistingPassword = config?.type === "email" && 
    (config.emailConfig as Record<string, unknown>)?.hasPassword === true;
  const hasExistingAccessToken = config?.type === "whatsapp" && 
    (config.whatsappConfig as Record<string, unknown>)?.hasAccessToken === true;

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
      } else if (config.type === "whatsapp" && config.whatsappConfig) {
        const wc = config.whatsappConfig as Record<string, unknown>;
        whatsappForm.reset({
          name: config.name,
          phoneNumberId: (wc.phoneNumberId as string) || "",
          accessToken: "",
          businessAccountId: (wc.businessAccountId as string) || "",
          webhookVerifyToken: (wc.webhookVerifyToken as string) || "",
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
        phoneNumberId: "",
        accessToken: "",
        businessAccountId: "",
        webhookVerifyToken: "",
      });
    }
  }, [open, config, emailForm, whatsappForm]);

  const createMutation = useMutation({
    mutationFn: async (data: { type: string; name: string; emailConfig?: Record<string, unknown>; whatsappConfig?: Record<string, unknown> }) => {
      await apiRequest("POST", "/api/channel-configs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: "Channel configuration created successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to create channel configuration", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; emailConfig?: Record<string, unknown>; whatsappConfig?: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/channel-configs/${config?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: "Channel configuration updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update channel configuration", variant: "destructive" });
    },
  });

  const onEmailSubmit = (data: EmailConfigFormData) => {
    const emailConfig: Record<string, unknown> = {
      imapHost: data.imapHost,
      imapPort: data.imapPort,
      imapSecure: data.imapSecure,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      email: data.email,
      fromName: data.fromName,
    };
    if (data.password) {
      emailConfig.password = data.password;
    } else if (!isEditing) {
      emailConfig.password = "";
    }
    const payload = {
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
    const whatsappConfig: Record<string, unknown> = {
      phoneNumberId: data.phoneNumberId,
      businessAccountId: data.businessAccountId,
      webhookVerifyToken: data.webhookVerifyToken,
    };
    if (data.accessToken) {
      whatsappConfig.accessToken = data.accessToken;
    } else if (!isEditing) {
      whatsappConfig.accessToken = "";
    }
    const payload = {
      type: "whatsapp",
      name: data.name,
      whatsappConfig,
    };
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Add"} {channelType === "email" ? "Email" : "WhatsApp"} Channel
          </DialogTitle>
          <DialogDescription>
            {channelType === "email"
              ? "Configure IMAP/SMTP settings to sync emails with your inbox."
              : "Connect your WhatsApp Business API account."}
          </DialogDescription>
        </DialogHeader>

        {channelType === "email" ? (
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Configuration Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Support Email, Sales Inbox" {...field} data-testid="input-email-config-name" />
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
                      <FormLabel>IMAP Host</FormLabel>
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
                      <FormLabel>IMAP Port</FormLabel>
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
                    <FormLabel className="!mt-0">Use SSL/TLS for IMAP</FormLabel>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={emailForm.control}
                  name="smtpHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Host</FormLabel>
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
                      <FormLabel>SMTP Port</FormLabel>
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
                    <FormLabel className="!mt-0">Use SSL/TLS for SMTP</FormLabel>
                  </FormItem>
                )}
              />
              <Separator />
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
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
                      Password / App Password
                      {isEditing && hasExistingPassword && (
                        <span className="text-muted-foreground ml-2 font-normal">(leave blank to keep current)</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder={hasExistingPassword ? "Enter new password to change" : "App-specific password"} 
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
                    <FormLabel>From Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Support Team" {...field} data-testid="input-from-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-channel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-channel">
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update" : "Add Channel"}
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
                    <FormLabel>Configuration Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Main WhatsApp, Support Line" {...field} data-testid="input-whatsapp-config-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={whatsappForm.control}
                name="phoneNumberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number ID</FormLabel>
                    <FormControl>
                      <Input placeholder="From Meta Business Suite" {...field} data-testid="input-phone-number-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={whatsappForm.control}
                name="accessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Access Token
                      {isEditing && hasExistingAccessToken && (
                        <span className="text-muted-foreground ml-2 font-normal">(leave blank to keep current)</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder={hasExistingAccessToken ? "Enter new token to change" : "WhatsApp Business API token"} 
                        {...field} 
                        data-testid="input-access-token" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={whatsappForm.control}
                name="businessAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Account ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Your WABA ID" {...field} data-testid="input-business-account-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={whatsappForm.control}
                name="webhookVerifyToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook Verify Token (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="For webhook verification" {...field} data-testid="input-webhook-token" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-whatsapp">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-whatsapp">
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update" : "Add Channel"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChannelConfigsSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [channelType, setChannelType] = useState<"email" | "whatsapp">("email");
  const [editingConfig, setEditingConfig] = useState<ChannelConfig | undefined>();
  const [testingId, setTestingId] = useState<number | null>(null);

  const { data: configs, isLoading } = useQuery<ChannelConfig[]>({
    queryKey: ["/api/channel-configs"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/channel-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      toast({ title: "Channel configuration deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete channel configuration", variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      setTestingId(id);
      const res = await apiRequest("POST", `/api/channel-configs/${id}/test`);
      return res.json();
    },
    onSuccess: (data) => {
      setTestingId(null);
      toast({ title: data.message || "Connection test successful" });
    },
    onError: () => {
      setTestingId(null);
      toast({ title: "Connection test failed", variant: "destructive" });
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>Channel Integrations</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleCreate("email")} data-testid="button-add-email-channel">
              <Mail className="h-4 w-4 mr-2" />
              Add Email
            </Button>
            <Button variant="outline" onClick={() => handleCreate("whatsapp")} data-testid="button-add-whatsapp-channel">
              <MessageSquare className="h-4 w-4 mr-2" />
              Add WhatsApp
            </Button>
          </div>
        </div>
        <CardDescription>Connect email accounts and WhatsApp Business to sync messages</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : configs && configs.length > 0 ? (
          <div className="space-y-3">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between gap-4 p-4 rounded-md border"
                data-testid={`channel-item-${config.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-md ${config.type === "email" ? "bg-blue-500/10" : "bg-green-500/10"}`}>
                    {config.type === "email" ? (
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium truncate" data-testid={`text-channel-name-${config.id}`}>
                        {config.name}
                      </h4>
                      <Badge variant={config.isActive ? "default" : "secondary"} className="capitalize text-xs">
                        {config.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {config.type === "email"
                        ? String((config.emailConfig as Record<string, unknown>)?.email || "No email configured")
                        : "WhatsApp Business API"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => testMutation.mutate(config.id)}
                    disabled={testingId === config.id}
                    data-testid={`button-test-channel-${config.id}`}
                  >
                    {testingId === config.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(config)} data-testid={`button-edit-channel-${config.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-delete-channel-${config.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Channel Configuration?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &quot;{config.name}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(config.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No channel integrations configured</p>
            <p className="text-sm">Add email or WhatsApp channels to sync messages</p>
          </div>
        )}
      </CardContent>
      <ChannelConfigDialog key={editingConfig?.id ?? 'new'} config={editingConfig} channelType={channelType} open={dialogOpen} onOpenChange={handleDialogChange} />
    </Card>
  );
}

const templateFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  variables: z.array(z.string()).optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

const AVAILABLE_VARIABLES = [
  { key: "{{contact.firstName}}", description: "Contact's first name" },
  { key: "{{contact.lastName}}", description: "Contact's last name" },
  { key: "{{contact.email}}", description: "Contact's email" },
  { key: "{{contact.phone}}", description: "Contact's phone" },
  { key: "{{contact.jobTitle}}", description: "Contact's job title" },
  { key: "{{deal.title}}", description: "Deal title" },
  { key: "{{deal.value}}", description: "Deal value" },
  { key: "{{company.name}}", description: "Company name" },
  { key: "{{user.firstName}}", description: "Your first name" },
  { key: "{{user.lastName}}", description: "Your last name" },
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
  const { toast } = useToast();
  const isEditing = !!template;

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name || "",
      subject: template?.subject || "",
      body: template?.body || "",
      variables: template?.variables || [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      await apiRequest("POST", "/api/email-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Template created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create template", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      await apiRequest("PATCH", `/api/email-templates/${template?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Template updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update template", variant: "destructive" });
    },
  });

  const onSubmit = (data: TemplateFormData) => {
    const variablesUsed = AVAILABLE_VARIABLES
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
          <DialogTitle>{isEditing ? "Edit Template" : "Create Email Template"}</DialogTitle>
          <DialogDescription>
            Create reusable email templates with variable placeholders for personalization.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Welcome Email, Follow-up Message" 
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
                  <FormLabel>Subject Line</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Welcome to {{company.name}}!" 
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
                  <FormLabel>Message Body</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Write your email template here..."
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
              <Label className="text-sm text-muted-foreground">Available Variables (click to insert)</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((variable) => (
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
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-template"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update Template" : "Create Template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EmailTemplatesSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>();

  const { data: templates, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/email-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Template deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
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
    toast({ title: "Copied to clipboard" });
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Email Templates</CardTitle>
          </div>
          <Button onClick={handleCreate} data-testid="button-create-template">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
        <CardDescription>Create and manage reusable email templates with variable substitution</CardDescription>
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
                    Subject: {template.subject}
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
                        <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{template.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(template.id)}
                          data-testid="button-confirm-delete"
                        >
                          Delete
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
            <p>No email templates yet</p>
            <p className="text-sm">Create your first template to speed up your communications</p>
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
          <CardTitle>Notifications</CardTitle>
        </div>
        <CardDescription>Manage your notification preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive email for new messages
              </p>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
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
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-muted-foreground">
                  {!isSupported
                    ? "Not available in your browser"
                    : permissionStatus === "denied"
                    ? "Blocked - enable in browser settings"
                    : isEnabled
                    ? "Notifications enabled"
                    : "Receive alerts when offline"}
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
              <p className="font-medium">Notification Sounds</p>
              <p className="text-sm text-muted-foreground">
                Play sounds for new messages
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

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold" data-testid="text-profile-name">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-profile-email">
                  {user?.email}
                </p>
                <Badge variant="secondary" className="mt-1 capitalize">
                  {user?.role || "sales"}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  defaultValue={user?.firstName || ""}
                  disabled
                  data-testid="input-settings-firstName"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  defaultValue={user?.lastName || ""}
                  disabled
                  data-testid="input-settings-lastName"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
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
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize how the app looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Toggle between light and dark mode
                </p>
              </div>
              <ThemeToggle />
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="font-medium">Theme Options</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                    theme === "light" ? "border-primary bg-accent" : "hover-elevate"
                  }`}
                  data-testid="button-theme-light"
                >
                  <div className="h-8 w-8 rounded-full bg-white border" />
                  <span className="text-sm">Light</span>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                    theme === "dark" ? "border-primary bg-accent" : "hover-elevate"
                  }`}
                  data-testid="button-theme-dark"
                >
                  <div className="h-8 w-8 rounded-full bg-zinc-900 border" />
                  <span className="text-sm">Dark</span>
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-colors ${
                    theme === "system" ? "border-primary bg-accent" : "hover-elevate"
                  }`}
                  data-testid="button-theme-system"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-white to-zinc-900 border" />
                  <span className="text-sm">System</span>
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
              <CardTitle>Account</CardTitle>
            </div>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Session</p>
                <p className="text-sm text-muted-foreground">
                  Sign out of your account
                </p>
              </div>
              <a href="/api/logout">
                <Button variant="outline" data-testid="button-settings-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <PipelineManagementSection />

        <EmailTemplatesSection />

        <ChannelConfigsSection />
      </div>
    </div>
  );
}
