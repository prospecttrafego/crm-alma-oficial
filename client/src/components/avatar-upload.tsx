import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  currentImageUrl?: string | null;
  fallback: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

const iconSizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function AvatarUpload({
  currentImageUrl,
  fallback,
  size = "lg",
  className,
}: AvatarUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const updateProfileMutation = useMutation({
    mutationFn: async (profileImageUrl: string) => {
      const response = await apiRequest("PATCH", "/api/users/me", {
        profileImageUrl,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Avatar atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar avatar", variant: "destructive" });
      setPreviewUrl(null);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Por favor, selecione uma imagem", variant: "destructive" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem muito grande. Máximo 5MB", variant: "destructive" });
      return;
    }

    // Show preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);

    try {
      // Get presigned upload URL
      const urlResponse = await apiRequest("POST", "/api/files/upload-url", {});
      const { uploadURL } = await urlResponse.json();

      // Upload to Supabase Storage
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      // Extract the public URL from the presigned URL
      // The presigned URL format is: https://xxx.supabase.co/storage/v1/object/bucket/path?token=...
      const publicUrl = uploadURL.split("?")[0];

      // Update user profile with new avatar URL
      await updateProfileMutation.mutateAsync(publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Erro ao fazer upload", variant: "destructive" });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className={cn("relative group", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <Avatar
        className={cn(
          sizeClasses[size],
          "cursor-pointer transition-opacity",
          uploading && "opacity-50"
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <AvatarImage src={displayUrl || undefined} alt="Avatar" />
        <AvatarFallback className="text-lg font-medium">
          {fallback}
        </AvatarFallback>
      </Avatar>

      {/* Hover overlay with camera icon */}
      <div
        className={cn(
          "absolute inset-0 rounded-full flex items-center justify-center",
          "bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
          uploading && "opacity-100"
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className={cn(iconSizeClasses[size], "text-white animate-spin")} />
        ) : (
          <Camera className={cn(iconSizeClasses[size], "text-white")} />
        )}
      </div>
    </div>
  );
}
