import type { Meta, StoryObj } from "@storybook/react";

import { NotificationBell } from "@/components/notification-bell";

const meta = {
  title: "Components/NotificationBell",
  component: NotificationBell,
} satisfies Meta<typeof NotificationBell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

