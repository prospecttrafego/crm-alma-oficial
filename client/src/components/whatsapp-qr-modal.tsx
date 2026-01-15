import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Smartphone } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { channelConfigsApi } from "@/lib/api/channelConfigs";
import type { WhatsAppStatusResponse } from "@shared/types";

interface WhatsAppQRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelConfigId: number;
  onConnected?: () => void;
}

type ConnectionStatus = WhatsAppStatusResponse;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

export function WhatsAppQRModal({
  open,
  onOpenChange,
  channelConfigId,
  onConnected,
}: WhatsAppQRModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Connect mutation - creates instance and gets QR code
  const connectMutation = useMutation({
    mutationFn: async () => {
      return channelConfigsApi.connectWhatsApp(channelConfigId);
    },
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setPairingCode(data.pairingCode || null);
      setIsConnecting(true);
      setRetryCount(0); // Reset retry count on success
      setIsRetrying(false);
    },
    onError: (error) => {
      console.error("Connect error:", error);
      setIsConnecting(false);
      // Automatic retry with exponential backoff
      if (retryCount < MAX_RETRIES) {
        setIsRetrying(true);
      }
    },
  });

  // Auto-retry effect with exponential backoff
  useEffect(() => {
    if (isRetrying && retryCount < MAX_RETRIES && !connectMutation.isPending) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[WhatsApp QR] Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        setIsRetrying(false);
        connectMutation.mutate();
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [isRetrying, retryCount, connectMutation]);

  // Poll connection status
  const { data: statusData } = useQuery<ConnectionStatus>({
    queryKey: ["whatsapp-status", channelConfigId],
    queryFn: () => channelConfigsApi.getWhatsAppStatus(channelConfigId),
    enabled: open && isConnecting,
    refetchInterval: isConnecting ? 3000 : false, // Poll every 3 seconds while connecting
  });

  // Handle successful connection
  useEffect(() => {
    if (statusData?.status === "connected") {
      setIsConnecting(false);
      setQrCode(null);
      setPairingCode(null);
      queryClient.invalidateQueries({ queryKey: ["/api/channel-configs"] });
      onConnected?.();
    }
  }, [statusData?.status, queryClient, onConnected]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQrCode(null);
      setPairingCode(null);
      setIsConnecting(false);
      setRetryCount(0);
      setIsRetrying(false);
    }
  }, [open]);

  // Start connection when modal opens
  const handleStartConnect = useCallback(() => {
    connectMutation.mutate();
  }, [connectMutation]);

  // Refresh QR code
  const handleRefreshQR = useCallback(() => {
    connectMutation.mutate();
  }, [connectMutation]);

  const isLoading = connectMutation.isPending || isRetrying;
  const isConnected = statusData?.status === "connected";
  // Only show error after all retries are exhausted
  const hasError = connectMutation.isError && !isRetrying && retryCount >= MAX_RETRIES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            {t("whatsappQr.title")}
          </DialogTitle>
          <DialogDescription>
            {t("whatsappQr.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          {/* Initial state - Start button */}
          {!qrCode && !isLoading && !isConnected && !hasError && (
            <div className="text-center space-y-4">
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <Smartphone className="h-16 w-16 text-muted-foreground" />
              </div>
              <Button onClick={handleStartConnect} className="w-full">
                {t("whatsappQr.generateQr")}
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="w-64 h-64 bg-muted rounded-lg flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                {isRetrying
                  ? `${t("whatsappQr.generatingQr")} (${retryCount + 1}/${MAX_RETRIES})`
                  : t("whatsappQr.generatingQr")}
              </p>
            </div>
          )}

          {/* QR Code display */}
          {qrCode && !isConnected && !isLoading && (
            <div className="space-y-4">
              <div className="relative">
                <div className="w-64 h-64 bg-white rounded-lg p-2 flex items-center justify-center">
                  {qrCode.startsWith("data:image") ? (
                    <img
                      src={qrCode}
                      alt="WhatsApp QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={`data:image/png;base64,${qrCode}`}
                      alt="WhatsApp QR Code"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                {isConnecting && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background px-2 py-1 rounded-full text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("whatsappQr.waitingConnection")}
                  </div>
                )}
              </div>

              {pairingCode && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{t("whatsappQr.orUsePairingCode")}</p>
                  <p className="text-xl font-mono font-bold tracking-widest mt-1">
                    {pairingCode}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRefreshQR}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t("whatsappQr.refreshQr")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  {t("common.cancel")}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {t("whatsappQr.instructions")}
              </p>
            </div>
          )}

          {/* Connected state */}
          {isConnected && (
            <div className="text-center space-y-4">
              <div className="w-64 h-64 bg-green-50 rounded-lg flex flex-col items-center justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
                <p className="mt-4 text-lg font-medium text-green-800">{t("whatsappQr.connected")}</p>
                <p className="text-sm text-green-600">
                  {t("whatsappQr.connectedSuccess")}
                </p>
              </div>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                {t("common.close")}
              </Button>
            </div>
          )}

          {/* Error state */}
          {hasError && !isLoading && (
            <div className="text-center space-y-4">
              <div className="w-64 h-64 bg-red-50 dark:bg-red-950/20 rounded-lg flex flex-col items-center justify-center">
                <XCircle className="h-16 w-16 text-red-600" />
                <p className="mt-4 text-lg font-medium text-red-800 dark:text-red-400">{t("whatsappQr.error")}</p>
                <p className="text-sm text-red-600 dark:text-red-500 max-w-[200px]">
                  {connectMutation.error?.message || t("whatsappQr.errorGeneratingQr")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setRetryCount(0); // Reset retry count for manual retry
                    handleStartConnect();
                  }}
                  className="flex-1"
                >
                  {t("whatsappQr.tryAgain")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
