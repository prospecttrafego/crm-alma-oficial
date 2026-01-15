/**
 * Pipeline Management Section
 * Displays and manages pipelines and their stages
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { pipelinesApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GitBranch, Plus, Pencil, Trash2, Star, GripVertical } from "lucide-react";
import type { PipelineWithStages } from "@shared/types";
import type { PipelineStage } from "@shared/schema";
import { PipelineDialog } from "./pipeline-dialog";
import { StageDialog } from "./stage-dialog";

export function PipelineManagementSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<PipelineWithStages | undefined>();
  const [editingStage, setEditingStage] = useState<PipelineStage | undefined>();
  const [selectedPipelineForStage, setSelectedPipelineForStage] = useState<PipelineWithStages | undefined>();
  const [expandedPipeline, setExpandedPipeline] = useState<number | null>(null);

  const { data: pipelines, isLoading } = useQuery<PipelineWithStages[]>({
    queryKey: ["/api/pipelines"],
    queryFn: pipelinesApi.list,
  });

  const deletePipelineMutation = useMutation({
    mutationFn: async (id: number) => {
      await pipelinesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.deleted") });
    },
    onError: (error: Error) => {
      toast({ title: error.message || t("settings.pipelines.toast.deleteError"), variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      await pipelinesApi.setDefault(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.defaultUpdated") });
    },
    onError: () => {
      toast({ title: t("settings.pipelines.toast.defaultError"), variant: "destructive" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async ({ pipelineId, stageId }: { pipelineId: number; stageId: number }) => {
      await pipelinesApi.deleteStage(pipelineId, stageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: t("settings.pipelines.toast.stageDeleted") });
    },
    onError: () => {
      toast({ title: t("settings.pipelines.toast.stageDeleteError"), variant: "destructive" });
    },
  });

  const handleCreatePipeline = () => {
    setEditingPipeline(undefined);
    setPipelineDialogOpen(true);
  };

  const handleEditPipeline = (pipeline: PipelineWithStages) => {
    setEditingPipeline(pipeline);
    setPipelineDialogOpen(true);
  };

  const handleAddStage = (pipeline: PipelineWithStages) => {
    setSelectedPipelineForStage(pipeline);
    setEditingStage(undefined);
    setStageDialogOpen(true);
  };

  const handleEditStage = (pipeline: PipelineWithStages, stage: PipelineStage) => {
    setSelectedPipelineForStage(pipeline);
    setEditingStage(stage);
    setStageDialogOpen(true);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.pipelines.title")}</CardTitle>
          </div>
          <Button onClick={handleCreatePipeline} data-testid="button-create-pipeline">
            <Plus className="h-4 w-4 mr-2" />
            {t("settings.pipelines.newPipeline")}
          </Button>
        </div>
        <CardDescription>{t("settings.pipelines.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : pipelines && pipelines.length > 0 ? (
          <div className="space-y-4">
            {pipelines.map((pipeline) => (
              <PipelineItem
                key={pipeline.id}
                pipeline={pipeline}
                isExpanded={expandedPipeline === pipeline.id}
                onToggleExpand={() => setExpandedPipeline(expandedPipeline === pipeline.id ? null : pipeline.id)}
                onEdit={() => handleEditPipeline(pipeline)}
                onSetDefault={() => setDefaultMutation.mutate(pipeline.id)}
                onDelete={() => deletePipelineMutation.mutate(pipeline.id)}
                onAddStage={() => handleAddStage(pipeline)}
                onEditStage={(stage) => handleEditStage(pipeline, stage)}
                onDeleteStage={(stageId) => deleteStageMutation.mutate({ pipelineId: pipeline.id, stageId })}
                isSetDefaultPending={setDefaultMutation.isPending}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("settings.pipelines.noPipelines")}</p>
            <p className="text-sm">{t("settings.pipelines.noPipelinesDescription")}</p>
          </div>
        )}
      </CardContent>
      <PipelineDialog
        pipeline={editingPipeline}
        open={pipelineDialogOpen}
        onOpenChange={(open) => {
          setPipelineDialogOpen(open);
          if (!open) setEditingPipeline(undefined);
        }}
      />
      {selectedPipelineForStage && (
        <StageDialog
          stage={editingStage}
          pipelineId={selectedPipelineForStage.id}
          stageCount={selectedPipelineForStage.stages?.length || 0}
          open={stageDialogOpen}
          onOpenChange={(open) => {
            setStageDialogOpen(open);
            if (!open) {
              setEditingStage(undefined);
              setSelectedPipelineForStage(undefined);
            }
          }}
        />
      )}
    </Card>
  );
}

interface PipelineItemProps {
  pipeline: PipelineWithStages;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
  onAddStage: () => void;
  onEditStage: (stage: PipelineStage) => void;
  onDeleteStage: (stageId: number) => void;
  isSetDefaultPending: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function PipelineItem({
  pipeline,
  isExpanded,
  onToggleExpand,
  onEdit,
  onSetDefault,
  onDelete,
  onAddStage,
  onEditStage,
  onDeleteStage,
  isSetDefaultPending,
  t,
}: PipelineItemProps) {
  return (
    <div className="rounded-md border" data-testid={`pipeline-item-${pipeline.id}`}>
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex-1 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2">
            <h4 className="font-medium" data-testid={`text-pipeline-name-${pipeline.id}`}>
              {pipeline.name}
            </h4>
            {pipeline.isDefault && (
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                {t("settings.pipelines.default")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {pipeline.stages?.length || 0} {t("settings.pipelines.stages").toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!pipeline.isDefault && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onSetDefault}
              disabled={isSetDefaultPending}
              data-testid={`button-set-default-${pipeline.id}`}
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            data-testid={`button-edit-pipeline-${pipeline.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {!pipeline.isDefault && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  data-testid={`button-delete-pipeline-${pipeline.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("settings.pipelines.deletePipeline")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("settings.pipelines.deletePipelineDescription", { name: pipeline.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>{t("common.delete")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">{t("settings.pipelines.stages")}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={onAddStage}
              data-testid={`button-add-stage-${pipeline.id}`}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t("settings.pipelines.addStage")}
            </Button>
          </div>
          <div className="space-y-2">
            {pipeline.stages?.sort((a, b) => a.order - b.order).map((stage) => (
              <StageItem
                key={stage.id}
                stage={stage}
                onEdit={() => onEditStage(stage)}
                onDelete={() => onDeleteStage(stage.id)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StageItemProps {
  stage: PipelineStage;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function StageItem({ stage, onEdit, onDelete, t }: StageItemProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 p-2 rounded-md bg-background border"
      data-testid={`stage-item-${stage.id}`}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: stage.color || "hsl(var(--primary))" }}
        />
        <span className="text-sm font-medium">{stage.name}</span>
        {stage.isWon && (
          <Badge variant="outline" className="text-xs text-green-600">
            {t("settings.pipelines.isWon")}
          </Badge>
        )}
        {stage.isLost && (
          <Badge variant="outline" className="text-xs text-red-600">
            {t("settings.pipelines.isLost")}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          data-testid={`button-edit-stage-${stage.id}`}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" data-testid={`button-delete-stage-${stage.id}`}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.pipelines.deletePipeline")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings.pipelines.deletePipelineDescription", { name: stage.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>{t("common.delete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
