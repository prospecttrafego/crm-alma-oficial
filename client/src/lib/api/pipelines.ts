/**
 * Pipelines API - CRUD operations for pipelines and stages
 */

import { api } from './index';
import { pipelineWithStagesSchema, pipelineStageSchema } from "@shared/apiSchemas";
import type { PipelineStage } from '@shared/schema';
import type {
  CreatePipelineDTO,
  UpdatePipelineDTO,
  CreatePipelineStageDTO,
  UpdatePipelineStageDTO,
} from '@shared/types';
import type { PipelineWithStages } from "@shared/types";
import { z } from "zod";

export const pipelinesApi = {
  /**
   * List all pipelines
   */
  list: () => api.get<PipelineWithStages[]>('/api/pipelines', z.array(pipelineWithStagesSchema)),

  /**
   * Get a single pipeline by ID (includes stages)
   */
  get: (id: number) => api.get<PipelineWithStages>(`/api/pipelines/${id}`, pipelineWithStagesSchema),

  /**
   * Get the default pipeline
   */
  getDefault: () => api.get<PipelineWithStages>('/api/pipelines/default', pipelineWithStagesSchema),

  /**
   * Create a new pipeline (can include inline stages)
   */
  create: (data: CreatePipelineDTO) => api.post<PipelineWithStages>('/api/pipelines', data, pipelineWithStagesSchema),

  /**
   * Update an existing pipeline
   */
  update: (id: number, data: UpdatePipelineDTO) =>
    api.patch<PipelineWithStages>(`/api/pipelines/${id}`, data, pipelineWithStagesSchema),

  /**
   * Delete a pipeline
   */
  delete: (id: number) => api.delete<void>(`/api/pipelines/${id}`),

  /**
   * Set a pipeline as default
   */
  setDefault: (id: number) =>
    api.post<PipelineWithStages>(`/api/pipelines/${id}/set-default`, {}, pipelineWithStagesSchema),

  // ===== STAGES =====

  /**
   * Create a new stage in a pipeline
   */
  createStage: (pipelineId: number, data: Omit<CreatePipelineStageDTO, 'pipelineId'>) =>
    api.post<PipelineStage>(`/api/pipelines/${pipelineId}/stages`, data, pipelineStageSchema),

  /**
   * Update a stage
   */
  updateStage: (pipelineId: number, stageId: number, data: UpdatePipelineStageDTO) =>
    api.patch<PipelineStage>(`/api/pipelines/${pipelineId}/stages/${stageId}`, data, pipelineStageSchema),

  /**
   * Delete a stage
   */
  deleteStage: (pipelineId: number, stageId: number) =>
    api.delete<void>(`/api/pipelines/${pipelineId}/stages/${stageId}`),
};
