import {
  pipelines,
  pipelineStages,
  type Pipeline,
  type InsertPipeline,
  type PipelineStage,
  type InsertPipelineStage,
} from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export async function getPipelines(_organizationId: number): Promise<Pipeline[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.organizationId, tenantOrganizationId));
}

export async function getPipeline(id: number): Promise<Pipeline | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)));
  return pipeline;
}

export async function getDefaultPipeline(
  _organizationId: number,
): Promise<Pipeline | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.organizationId, tenantOrganizationId), eq(pipelines.isDefault, true)));
  return pipeline;
}

export async function createPipeline(pipeline: InsertPipeline): Promise<Pipeline> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(pipelines)
    .values({ ...pipeline, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

export async function getPipelineStages(pipelineId: number): Promise<PipelineStage[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const rows = await db
    .select()
    .from(pipelineStages)
    .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
    .where(
      and(
        eq(pipelineStages.pipelineId, pipelineId),
        eq(pipelines.organizationId, tenantOrganizationId),
      ),
    )
    .orderBy(pipelineStages.order);

  return rows.map((row) => row.pipeline_stages);
}

export async function createPipelineStage(
  stage: InsertPipelineStage,
): Promise<PipelineStage> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [pipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, stage.pipelineId), eq(pipelines.organizationId, tenantOrganizationId)))
    .limit(1);

  if (!pipeline) {
    throw new Error("Pipeline not found");
  }

  const { pipelineId, ...insertData } = stage as InsertPipelineStage;
  const [created] = await db
    .insert(pipelineStages)
    .values({ ...insertData, pipelineId })
    .returning();
  return created;
}

export async function updatePipeline(
  id: number,
  pipeline: Partial<InsertPipeline>,
): Promise<Pipeline | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { organizationId: _organizationId, ...updateData } = pipeline as Partial<
    InsertPipeline & { organizationId?: number }
  >;
  const [updated] = await db
    .update(pipelines)
    .set({ ...updateData, updatedAt: new Date() })
    .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function deletePipeline(id: number): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [pipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
    .limit(1);

  if (!pipeline) return;

  await db.delete(pipelineStages).where(eq(pipelineStages.pipelineId, id));
  await db
    .delete(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)));
}

export async function setDefaultPipeline(
  id: number,
  _organizationId: number,
): Promise<Pipeline | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db
    .update(pipelines)
    .set({ isDefault: false })
    .where(eq(pipelines.organizationId, tenantOrganizationId));
  const [updated] = await db
    .update(pipelines)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function updatePipelineStage(
  id: number,
  stage: Partial<InsertPipelineStage>,
): Promise<PipelineStage | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [existing] = await db
    .select({ pipelineId: pipelineStages.pipelineId })
    .from(pipelineStages)
    .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
    .where(and(eq(pipelineStages.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
    .limit(1);

  if (!existing) return undefined;

  const { pipelineId: _pipelineId, ...updateData } = stage as Partial<
    InsertPipelineStage & { pipelineId?: number }
  >;
  const [updated] = await db
    .update(pipelineStages)
    .set(updateData)
    .where(and(eq(pipelineStages.id, id), eq(pipelineStages.pipelineId, existing.pipelineId)))
    .returning();
  return updated;
}

export async function deletePipelineStage(id: number): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [existing] = await db
    .select({ pipelineId: pipelineStages.pipelineId })
    .from(pipelineStages)
    .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
    .where(and(eq(pipelineStages.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
    .limit(1);

  if (!existing) return;

  await db
    .delete(pipelineStages)
    .where(and(eq(pipelineStages.id, id), eq(pipelineStages.pipelineId, existing.pipelineId)));
}
