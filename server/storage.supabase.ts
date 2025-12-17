/**
 * Servico de armazenamento de objetos usando Supabase Storage
 * Substitui Google Cloud Storage via Replit sidecar
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Response } from "express";
import { randomUUID } from "crypto";

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
  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    const objectPath = `uploads/${objectId}`;

    const { data, error } = await this.client.storage
      .from(DEFAULT_BUCKET)
      .createSignedUploadUrl(objectPath);

    if (error) {
      throw new Error(`Erro ao gerar URL de upload: ${error.message}`);
    }

    return data.signedUrl;
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
      console.error("Erro ao baixar arquivo:", error);
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

    // Se e uma URL do Supabase, extrai o path
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl && rawPath.startsWith(supabaseUrl)) {
      const url = new URL(rawPath);
      const pathParts = url.pathname.split("/storage/v1/object/public/");
      if (pathParts.length > 1) {
        return `/objects/${pathParts[1]}`;
      }
    }

    return rawPath;
  }

  /**
   * Define politica de ACL (Supabase usa RLS, este metodo e para compatibilidade)
   */
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    // Supabase usa Row Level Security (RLS) em vez de ACLs por objeto
    // Esta funcao existe para compatibilidade com o codigo antigo
    // A configuracao de acesso deve ser feita via politicas RLS no Supabase
    return normalizedPath;
  }

  /**
   * Verifica acesso a objeto (compatibilidade)
   */
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: { path: string; exists: boolean };
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    // Com Supabase, o controle de acesso e feito via RLS
    // Por padrao, permitimos acesso se o arquivo existe
    // Implementar logica customizada conforme necessario
    return objectFile.exists;
  }
}
