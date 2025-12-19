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

interface WhatsAppQRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelConfigId: number;
  onConnected?: () => void;
}

interface ConnectionStatus {
  status: "disconnected" | "connecting" | "connected" | "qr_pending";
  instanceName: string | null;
  lastConnectedAt?: string;
}

interface ConnectResponse {
  instanceName: string;
  qrCode: string;
  pairingCode?: string;
  status: string;
}

export function WhatsAppQRModal({
  open,
  onOpenChange,
  channelConfigId,
  onConnected,
}: WhatsAppQRModalProps) {
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Connect mutation - creates instance and gets QR code
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/channel-configs/${channelConfigId}/whatsapp/connect`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to connect");
      }
      return res.json() as Promise<ConnectResponse>;
    },
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setPairingCode(data.pairingCode || null);
      setIsConnecting(true);
    },
    onError: (error) => {
      console.error("Connect error:", error);
      setIsConnecting(false);
    },
  });

  // Poll connection status
  const { data: statusData, refetch: refetchStatus } = useQuery<ConnectionStatus>({
    queryKey: ["whatsapp-status", channelConfigId],
    queryFn: async () => {
      const res = await fetch(`/api/channel-configs/${channelConfigId}/whatsapp/status`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to get status");
      return res.json();
    },
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

  const isLoading = connectMutation.isPending;
  const isConnected = statusData?.status === "connected";
  const hasError = connectMutation.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code com o WhatsApp do seu celular para conectar
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
                Gerar QR Code
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="w-64 h-64 bg-muted rounded-lg flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Gerando QR Code...</p>
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
                    Aguardando conexão...
                  </div>
                )}
              </div>

              {pairingCode && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Ou use o código de pareamento:</p>
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
                  Atualizar QR
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Abra o WhatsApp no seu celular, vá em Configurações {">"} Aparelhos conectados {">"} Conectar um aparelho
              </p>
            </div>
          )}

          {/* Connected state */}
          {isConnected && (
            <div className="text-center space-y-4">
              <div className="w-64 h-64 bg-green-50 rounded-lg flex flex-col items-center justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
                <p className="mt-4 text-lg font-medium text-green-800">Conectado!</p>
                <p className="text-sm text-green-600">
                  WhatsApp conectado com sucesso
                </p>
              </div>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Fechar
              </Button>
            </div>
          )}

          {/* Error state */}
          {hasError && !isLoading && (
            <div className="text-center space-y-4">
              <div className="w-64 h-64 bg-red-50 rounded-lg flex flex-col items-center justify-center">
                <XCircle className="h-16 w-16 text-red-600" />
                <p className="mt-4 text-lg font-medium text-red-800">Erro</p>
                <p className="text-sm text-red-600 max-w-[200px]">
                  {connectMutation.error?.message || "Falha ao gerar QR Code"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleStartConnect} className="flex-1">
                  Tentar novamente
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
