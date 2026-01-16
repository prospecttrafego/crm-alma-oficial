import type { Meta, StoryObj } from "@storybook/react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "Button",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button variant="default">
        <Plus /> Default
      </Button>
      <Button variant="secondary">
        <Plus /> Secondary
      </Button>
      <Button variant="outline">
        <Plus /> Outline
      </Button>
      <Button variant="ghost">
        <Plus /> Ghost
      </Button>
      <Button variant="link">Link</Button>
      <Button variant="destructive">
        <Trash2 /> Destructive
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Icon button">
        <Plus />
      </Button>
    </div>
  ),
};

