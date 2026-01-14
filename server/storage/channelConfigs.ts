import { channelConfigs, type ChannelConfig, type InsertChannelConfig } from "@shared/schema";
import { db } from "../db";
import { and, desc, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export async function getChannelConfigs(_organizationId: number): Promise<ChannelConfig[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.organizationId, tenantOrganizationId))
    .orderBy(desc(channelConfigs.createdAt));
}

export async function getChannelConfig(id: number): Promise<ChannelConfig | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [config] = await db
    .select()
    .from(channelConfigs)
    .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)));
  return config;
}

export async function createChannelConfig(
  config: InsertChannelConfig,
): Promise<ChannelConfig> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(channelConfigs)
    .values({ ...config, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

export async function updateChannelConfig(
  id: number,
  config: Partial<InsertChannelConfig>,
): Promise<ChannelConfig | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  // Fetch existing config to merge nested JSONB objects (preserves secrets if not provided)
  const [existing] = await db
    .select()
    .from(channelConfigs)
    .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)));
  if (!existing) return undefined;

  const updateData: Partial<InsertChannelConfig> = { ...config };

  // Merge email config - preserve password if not provided or empty in update
  if (config.emailConfig && existing.emailConfig) {
    const existingEmailConfig = existing.emailConfig as Record<string, unknown>;
    const newEmailConfig = config.emailConfig as Record<string, unknown>;
    // Treat undefined, null, and empty string as "preserve existing"
    const newPassword = newEmailConfig.password;
    if ((newPassword === undefined || newPassword === null || newPassword === "") && existingEmailConfig.password) {
      const mergedConfig = { ...newEmailConfig };
      delete mergedConfig.password; // Remove empty password field
      updateData.emailConfig = {
        ...mergedConfig,
        password: existingEmailConfig.password,
      } as typeof config.emailConfig;
    }
  }

  // Merge whatsapp config - preserve accessToken if not provided or empty in update
  if (config.whatsappConfig && existing.whatsappConfig) {
    const existingWhatsappConfig = existing.whatsappConfig as Record<string, unknown>;
    const newWhatsappConfig = config.whatsappConfig as Record<string, unknown>;
    // Treat undefined, null, and empty string as "preserve existing"
    const newToken = newWhatsappConfig.accessToken;
    if ((newToken === undefined || newToken === null || newToken === "") && existingWhatsappConfig.accessToken) {
      const mergedConfig = { ...newWhatsappConfig };
      delete mergedConfig.accessToken; // Remove empty token field
      updateData.whatsappConfig = {
        ...mergedConfig,
        accessToken: existingWhatsappConfig.accessToken,
      } as typeof config.whatsappConfig;
    }
  }

  const { organizationId: _organizationId, ...finalUpdate } = updateData as Partial<
    InsertChannelConfig & { organizationId?: number }
  >;

  const [updated] = await db
    .update(channelConfigs)
    .set({ ...finalUpdate, updatedAt: new Date() })
    .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function deleteChannelConfig(id: number): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db
    .delete(channelConfigs)
    .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)));
}

export async function updateChannelConfigLastSync(
  id: number,
): Promise<ChannelConfig | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [updated] = await db
    .update(channelConfigs)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}
