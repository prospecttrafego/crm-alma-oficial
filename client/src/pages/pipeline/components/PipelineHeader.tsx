import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterPanel, type PipelineFilters } from "@/components/filter-panel";
import { useTranslation } from "@/contexts/LanguageContext";
import type { Contact, PipelineStage } from "@shared/schema";
import type { PipelineWithStages } from "@shared/types";

import { NewDealDialog } from "./NewDealDialog";

type Props = {
  pipeline: PipelineWithStages | undefined;
  allPipelines: PipelineWithStages[] | undefined;
  selectedPipelineId: number | null;
  onSelectPipelineId: (pipelineId: number) => void;
  filters: PipelineFilters;
  onFiltersChange: (filters: PipelineFilters) => void;
  stages: PipelineStage[] | undefined;
  newDealOpen: boolean;
  onNewDealOpenChange: (open: boolean) => void;
  onCreateDeal: (event: React.FormEvent<HTMLFormElement>) => void;
  contacts: Contact[];
  probabilityValue: number;
  onProbabilityValueChange: (value: number) => void;
  createDealPending: boolean;
};

export function PipelineHeader({
  pipeline,
  allPipelines,
  selectedPipelineId,
  onSelectPipelineId,
  filters,
  onFiltersChange,
  stages,
  newDealOpen,
  onNewDealOpenChange,
  onCreateDeal,
  contacts,
  probabilityValue,
  onProbabilityValueChange,
  createDealPending,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 border-b p-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold" data-testid="text-pipeline-title">
            {t("pipeline.title")}
          </h1>
          {allPipelines && allPipelines.length > 1 && (
            <Select value={selectedPipelineId?.toString() || ""} onValueChange={(val) => onSelectPipelineId(Number(val))}>
              <SelectTrigger className="w-[200px]" data-testid="select-pipeline">
                <SelectValue placeholder={t("settings.pipelines.pipelineName")}>{pipeline?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allPipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()} data-testid={`select-pipeline-option-${p.id}`}>
                    {p.name} {p.isDefault && `(${t("settings.pipelines.default")})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(!allPipelines || allPipelines.length <= 1) && (
            <span className="text-lg font-semibold text-muted-foreground">{pipeline?.name}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("pipeline.dragToMove")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterPanel type="pipeline" filters={filters} onFiltersChange={(f) => onFiltersChange(f as PipelineFilters)} stages={stages} />
        <NewDealDialog
          open={newDealOpen}
          onOpenChange={onNewDealOpenChange}
          onSubmit={onCreateDeal}
          onCancel={() => onNewDealOpenChange(false)}
          contacts={contacts}
          probabilityValue={probabilityValue}
          onProbabilityValueChange={onProbabilityValueChange}
          submitting={createDealPending}
        />
      </div>
    </div>
  );
}

