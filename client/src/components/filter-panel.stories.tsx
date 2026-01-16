import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { FilterPanel, type PipelineFilters } from "@/components/filter-panel";
import type { PipelineStage } from "@shared/schema";

const stages: PipelineStage[] = [
  {
    id: 1,
    name: "Novo Lead",
    pipelineId: 1,
    order: 0,
    color: "#41B6E6",
    isWon: false,
    isLost: false,
    createdAt: new Date(),
  },
  {
    id: 2,
    name: "Qualificado",
    pipelineId: 1,
    order: 1,
    color: "#22C55E",
    isWon: false,
    isLost: false,
    createdAt: new Date(),
  },
];

function FilterPanelDemo() {
  const [filters, setFilters] = useState<PipelineFilters>({});

  return (
    <div className="space-y-4">
      <FilterPanel type="pipeline" filters={filters} onFiltersChange={setFilters} stages={stages} />
      <pre className="max-w-[520px] overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
        {JSON.stringify(filters, null, 2)}
      </pre>
    </div>
  );
}

const meta = {
  title: "Components/FilterPanel",
  component: FilterPanelDemo,
} satisfies Meta<typeof FilterPanelDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Pipeline: Story = {};
