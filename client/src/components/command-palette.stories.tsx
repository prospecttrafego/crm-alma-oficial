import type { Meta, StoryObj } from "@storybook/react";

import { CommandPalette } from "@/components/command-palette";

const meta = {
  title: "Components/CommandPalette",
  component: CommandPalette,
} satisfies Meta<typeof CommandPalette>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

