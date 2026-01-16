import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/Input",
  component: Input,
  args: {
    placeholder: "Type something…",
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: {
    value: "Hello from Storybook",
    readOnly: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: "Disabled input",
    readOnly: true,
  },
};

