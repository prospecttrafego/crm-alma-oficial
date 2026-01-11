/**
 * Pipelines API - CRUD operations for pipelines and stages
 */

import { api } from './index';
import type { Pipeline, PipelineStage } from '@shared/schema';
import type {
  CreatePipelineDTO,
  UpdatePipelineDTO,
  CreatePipelineStageDTO,
  UpdatePipelineStageDTO,
} from '@shared/types';

// Extended type for pipeline with stages
export interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[];
}

export const pipelinesApi = {
  /**
   * List all pipelines
   */
  list: () => api.get<Pipeline[]>('/api/pipelines'),

  /**
   * Get a single pipeline by ID (includes stages)
   */
  get: (id: number) => api.get<PipelineWithStages>(`/api/pipelines/${id}`),

  /**
   * Get the default pipeline
   */
  getDefault: () => api.get<PipelineWithStages>('/api/pipelines/default'),

  /**
   * Create a new pipeline (can include inline stages)
   */
  create: (data: CreatePipelineDTO) => api.post<Pipeline>('/api/pipelines', data),

  /**
   * Update an existing pipeline
   */
  update: (id: number, data: UpdatePipelineDTO) =>
    api.patch<Pipeline>(`/api/pipelines/${id}`, data),

  /**
   * Delete a pipeline
   */
  delete: (id: number) => api.delete<void>(`/api/pipelines/${id}`),

  /**
   * Set a pipeline as default
   */
  setDefault: (id: number) =>
    api.post<Pipeline>(`/api/pipelines/${id}/set-default`, {}),

  // ===== STAGES =====

  /**
   * Create a new stage in a pipeline
   */
  createStage: (pipelineId: number, data: Omit<CreatePipelineStageDTO, 'pipelineId'>) =>
    api.post<PipelineStage>(`/api/pipelines/${pipelineId}/stages`, data),

  /**
   * Update a stage
   */
  updateStage: (pipelineId: number, stageId: number, data: UpdatePipelineStageDTO) =>
    api.patch<PipelineStage>(`/api/pipelines/${pipelineId}/stages/${stageId}`, data),

  /**
   * Delete a stage
   */
  deleteStage: (pipelineId: number, stageId: number) =>
    api.delete<void>(`/api/pipelines/${pipelineId}/stages/${stageId}`),
};
