/**
 * Channel Configuration Dialog
 * Handles Email and WhatsApp channel configuration
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { channelConfigsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { Wifi, WifiOff, Loader2, QrCode } from "lucide-react";
import { WhatsAppQRModal } from "@/components/whatsapp-qr-modal";
import type { CreateChannelConfigDTO, UpdateChannelConfigDTO, ChannelConfigPublic } from "@shared/types";

type Translator = (key: string, params?: Record<string, string | number>) => string;

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

const createWhatsappConfigSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t("validation.required")),
  });

type EmailConfigFormData = z.infer<ReturnType<typeof createEmailConfigSchema>>;
type WhatsappConfigFormData = z.infer<ReturnType<typeof createWhatsappConfigSchema>>;

interface ChannelConfigDialogProps {
  config?: ChannelConfigPublic;
  channelType: "email" | "whatsapp";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChannelConfigDialog({
  config,
  channelType,
  open,
  onOpenChange,
}: ChannelConfigDialogProps) {
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

  const hasExistingPassword = config?.type === "email" && config.emailConfig?.hasPassword === true;
  const whatsappConfig = config?.type === "whatsapp" ? config.whatsappConfig : null;
  const connectionStatus = whatsappConfig?.connectionStatus || "disconnected";
  const instanceName = whatsappConfig?.instanceName;

  const dialogTitle = channelType === "email"
    ? (isEditing ? t("settings.channels.dialog.editEmailTitle") : t("settings.channels.dialog.addEmailTitle"))
    : (isEditing ? t("settings.channels.dialog.editWhatsappTitle") : t("settings.channels.dialog.addWhatsappTitle"));
  const dialogDescription = channelType === "email"
    ? t("settings.channels.dialog.emailDescription")
    : t("settings.channels.dialog.whatsappDescription");

  useEffect(() => {
    if (open && config) {
      if (config.type === "email" && config.emailConfig) {
        const ec = config.emailConfig;
        emailForm.reset({
          name: config.name,
          imapHost: ec.imapHost || "",
          imapPort: ec.imapPort || 993,
          imapSecure: ec.imapSecure ?? true,
          smtpHost: ec.smtpHost || "",
          smtpPort: ec.smtpPort || 587,
          smtpSecure: ec.smtpSecure ?? true,
          email: ec.email || "",
          password: "",
          fromName: ec.fromName || "",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {channelType === "email" ? (
          <EmailConfigForm
            form={emailForm}
            onSubmit={onEmailSubmit}
            onCancel={() => onOpenChange(false)}
            isEditing={isEditing}
            hasExistingPassword={hasExistingPassword}
            isPending={createMutation.isPending || updateMutation.isPending}
            t={t}
          />
        ) : (
          <WhatsAppConfigForm
            form={whatsappForm}
            onSubmit={onWhatsappSubmit}
            onCancel={() => onOpenChange(false)}
            isEditing={isEditing}
            connectionStatus={connectionStatus}
            instanceName={instanceName}
            onConnect={() => setQrModalOpen(true)}
            onDisconnect={() => disconnectMutation.mutate()}
            isDisconnectPending={disconnectMutation.isPending}
            isPending={createMutation.isPending || updateMutation.isPending}
            t={t}
          />
        )}

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

interface EmailConfigFormProps {
  form: ReturnType<typeof useForm<EmailConfigFormData>>;
  onSubmit: (data: EmailConfigFormData) => void;
  onCancel: () => void;
  isEditing: boolean;
  hasExistingPassword: boolean;
  isPending: boolean;
  t: Translator;
}

function EmailConfigForm({
  form,
  onSubmit,
  onCancel,
  isEditing,
  hasExistingPassword,
  isPending,
  t,
}: EmailConfigFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
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
            control={form.control}
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
            control={form.control}
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
          control={form.control}
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
            control={form.control}
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
            control={form.control}
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
          control={form.control}
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
          control={form.control}
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
          control={form.control}
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
          control={form.control}
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
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-channel">
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-save-channel">
            {isPending
              ? t("common.saving")
              : isEditing
              ? t("common.update")
              : t("settings.channels.addChannel")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

interface WhatsAppConfigFormProps {
  form: ReturnType<typeof useForm<WhatsappConfigFormData>>;
  onSubmit: (data: WhatsappConfigFormData) => void;
  onCancel: () => void;
  isEditing: boolean;
  connectionStatus: string;
  instanceName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  isDisconnectPending: boolean;
  isPending: boolean;
  t: Translator;
}

function WhatsAppConfigForm({
  form,
  onSubmit,
  onCancel,
  isEditing,
  connectionStatus,
  instanceName,
  onConnect,
  onDisconnect,
  isDisconnectPending,
  isPending,
  t,
}: WhatsAppConfigFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
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
                    onClick={onDisconnect}
                    disabled={isDisconnectPending}
                  >
                    {isDisconnectPending ? (
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
                    onClick={onConnect}
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
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-whatsapp">
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-save-whatsapp">
            {isPending
              ? t("common.saving")
              : isEditing
              ? t("common.update")
              : t("common.add")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
