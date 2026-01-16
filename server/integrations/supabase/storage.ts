/**
 * Servico de armazenamento de objetos usando Supabase Storage
 * Substitui Google Cloud Storage via Replit sidecar
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Response } from "express";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { files, users } from "@shared/schema";
import { db } from "../../db";
import { MAX_FILE_SIZE_BYTES } from "../../constants";
import { getSingleTenantOrganizationId } from "../../tenant";
import { createServiceLogger } from "../../logger";

const storageLogger = createServiceLogger("supabase-storage");

// Cliente Supabase com service_role key para acesso administrativo
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados"
      );
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

// Nome do bucket padrao para uploads
const DEFAULT_BUCKET = "uploads";
const DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS = 15000;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Objeto nao encontrado");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export class ObjectStorageService {
  private client: SupabaseClient;

  constructor() {
    this.client = getSupabaseClient();
  }

  /**
   * Faz upload de um arquivo para o Supabase Storage
   */
  async uploadFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    folder: string = "uploads"
  ): Promise<string> {
    const objectId = randomUUID();
    const objectPath = `${folder}/${objectId}/${fileName}`;

    const { error } = await this.client.storage
      .from(DEFAULT_BUCKET)
      .upload(objectPath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Erro ao fazer upload: ${error.message}`);
    }

    return objectPath;
  }

  /**
   * Obtem URL publica de um arquivo
   */
  getPublicUrl(objectPath: string): string {
    const { data } = this.client.storage
      .from(DEFAULT_BUCKET)
      .getPublicUrl(objectPath);

    return data.publicUrl;
  }

  /**
   * Obtem URL assinada (temporaria) para acesso privado
   */
  async getSignedUrl(objectPath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(DEFAULT_BUCKET)
      .createSignedUrl(objectPath, expiresIn);

    if (error) {
      throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Gera URL de upload assinada para upload direto do cliente
   */
  async getObjectEntityUploadURL(): Promise<{ uploadURL: string; objectPath: string; storagePath: string }> {
    const objectId = randomUUID();
    const storagePath = `uploads/${objectId}`;

    const { data, error } = await this.client.storage
      .from(DEFAULT_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error) {
      throw new Error(`Erro ao gerar URL de upload: ${error.message}`);
    }

    const resolvedStoragePath = data.path || storagePath;
    return {
      uploadURL: data.signedUrl,
      storagePath: resolvedStoragePath,
      objectPath: `/objects/${resolvedStoragePath}`,
    };
  }

  /**
   * Deleta um arquivo do storage
   */
  async deleteFile(objectPath: string): Promise<void> {
    const { error } = await this.client.storage
      .from(DEFAULT_BUCKET)
      .remove([objectPath]);

    if (error) {
      throw new Error(`Erro ao deletar arquivo: ${error.message}`);
    }
  }

  /**
   * Lista arquivos em uma pasta
   */
  async listFiles(folder: string): Promise<string[]> {
    const { data, error } = await this.client.storage
      .from(DEFAULT_BUCKET)
      .list(folder);

    if (error) {
      throw new Error(`Erro ao listar arquivos: ${error.message}`);
    }

    return data.map((file) => `${folder}/${file.name}`);
  }

  /**
   * Obtem arquivo e envia como stream para response HTTP
   */
  async downloadObject(objectPath: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const { data, error } = await this.client.storage
        .from(DEFAULT_BUCKET)
        .download(objectPath);

      if (error || !data) {
        throw new ObjectNotFoundError();
      }

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.set({
        "Content-Type": data.type || "application/octet-stream",
        "Content-Length": buffer.length,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      res.send(buffer);
    } catch (error) {
      storageLogger.error("Erro ao baixar arquivo", { error });
      if (error instanceof ObjectNotFoundError) {
        throw error;
      }
      throw new Error("Erro ao baixar arquivo");
    }
  }

  /**
   * Obtem arquivo pela URL de objeto (compatibilidade com codigo antigo)
   */
  async getObjectEntityFile(objectPath: string): Promise<{ path: string; exists: boolean }> {
    // Limpar path se tiver prefixo /objects/
    let cleanPath = objectPath;
    if (cleanPath.startsWith("/objects/")) {
      cleanPath = cleanPath.replace("/objects/", "");
    }

    // Verificar se arquivo existe
    const folderPath = cleanPath.split("/").slice(0, -1).join("/");
    const fileName = cleanPath.split("/").pop();

    if (!fileName) {
      throw new ObjectNotFoundError();
    }

    const { data, error } = await this.client.storage
      .from(DEFAULT_BUCKET)
      .list(folderPath);

    if (error) {
      throw new ObjectNotFoundError();
    }

    const exists = data.some((file) => file.name === fileName);

    if (!exists) {
      throw new ObjectNotFoundError();
    }

    return { path: cleanPath, exists: true };
  }

  /**
   * Normaliza path de objeto (compatibilidade)
   */
  normalizeObjectEntityPath(rawPath: string): string {
    // Se ja e um path normalizado, retorna como esta
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    // Se parece ser um path dentro do bucket, normaliza para /objects/<path>
    if (!rawPath.includes("://")) {
      return `/objects/${rawPath.replace(/^\/+/, "")}`;
    }

    // Se e uma URL do Supabase, extrai o path (sempre removendo o nome do bucket)
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl && rawPath.startsWith(supabaseUrl)) {
      const url = new URL(rawPath);

      const patterns = [
        /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)/,
        /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/,
        /^\/storage\/v1\/object\/upload\/sign\/([^/]+)\/(.+)/,
      ];

      for (const pattern of patterns) {
        const match = url.pathname.match(pattern);
        if (!match) continue;
        const bucket = match[1];
        const path = match[2];

        if (bucket !== DEFAULT_BUCKET) {
          return rawPath;
        }

        return `/objects/${path}`;
      }
    }

    return rawPath;
  }

  /**
   * Define politica de ACL (Supabase usa RLS, este metodo e para compatibilidade)
   */
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    _aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    // Supabase usa Row Level Security (RLS) em vez de ACLs por objeto
    // Esta funcao existe para compatibilidade com o codigo antigo
    // A configuracao de acesso deve ser feita via politicas RLS no Supabase
    return normalizedPath;
  }

  /**
   * Download media from URL and upload to Supabase Storage
   * Returns the object path and public URL
   */
  async downloadAndUploadFromUrl(
    sourceUrl: string,
    mimeType: string,
    fileName?: string,
    folder: string = "whatsapp-media"
  ): Promise<{ objectPath: string; publicUrl: string; fileName: string }> {
    try {
      const parsedUrl = new URL(sourceUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}`);
      }

      // SSRF hardening: only allow downloads from explicitly configured hosts.
      // For WhatsApp media this should be the Evolution API host.
      const allowedHosts = new Set<string>();
      if (process.env.EVOLUTION_API_URL) {
        try {
          allowedHosts.add(new URL(process.env.EVOLUTION_API_URL).hostname);
        } catch (_error) {
          throw new Error("EVOLUTION_API_URL is invalid. Expected a full URL (e.g., https://evolution.example.com).");
        }
      }

      const extraAllowedHosts = process.env.MEDIA_DOWNLOAD_ALLOWED_HOSTS;
      if (extraAllowedHosts) {
        extraAllowedHosts
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean)
          .forEach((h) => allowedHosts.add(h));
      }

      if (allowedHosts.size === 0) {
        throw new Error(
          "Media download blocked: no allowed hosts configured (set EVOLUTION_API_URL or MEDIA_DOWNLOAD_ALLOWED_HOSTS)."
        );
      }

      if (!allowedHosts.has(parsedUrl.hostname)) {
        throw new Error(`Media download blocked: host not allowed (${parsedUrl.hostname})`);
      }

      // Fetch the media from the source URL
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS);

      let response: globalThis.Response;
      try {
        response = await fetch(sourceUrl, {
          headers: {
            'User-Agent': 'CRM-Alma/1.0',
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Failed to download media: ${response.status}`);
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const size = Number(contentLength);
        if (Number.isFinite(size) && size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`Media download blocked: file too large (${size} bytes)`);
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Media download blocked: file too large (${buffer.length} bytes)`);
      }

      // Generate file name if not provided
      const extension = this.getExtensionFromMimeType(mimeType);
      const finalFileName = fileName || `media_${Date.now()}${extension}`;

      // Upload to Supabase
      const objectPath = await this.uploadFile(buffer, finalFileName, mimeType, folder);
      const publicUrl = this.getPublicUrl(objectPath);

      return { objectPath, publicUrl, fileName: finalFileName };
    } catch (error) {
      storageLogger.error("Error downloading/uploading media", { error });
      throw error;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'audio/ogg': '.ogg',
      'audio/opus': '.opus',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    };

    return mimeToExt[mimeType] || '';
  }

  /**
   * Verifica acesso a objeto (compatibilidade)
   */
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission: _requestedPermission,
  }: {
    userId?: string;
    objectFile: { path: string; exists: boolean };
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    if (!userId) return false;
    if (!objectFile.exists) return false;

    // We enforce access in the app by requiring the object to be registered in `files` for the tenant org.
    const tenantOrganizationId = await getSingleTenantOrganizationId();
    const normalizedObjectPath = `/objects/${objectFile.path.replace(/^\/+/, "")}`;

    const [fileRecord] = await db
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.organizationId, tenantOrganizationId), eq(files.objectPath, normalizedObjectPath)))
      .limit(1);

    if (fileRecord) return true;

    // Allow access to user avatars referenced in `users.profileImageUrl` for the tenant org.
    const [avatarOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.organizationId, tenantOrganizationId), eq(users.profileImageUrl, normalizedObjectPath)))
      .limit(1);

    return !!avatarOwner;
  }
}
