import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  args: {
    children: "Button",
    variant: "primary",
    disabled: false,
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "danger", "invisible"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Danger: Story = { args: { variant: "danger" } };
export const Invisible: Story = { args: { variant: "invisible" } };
export const Disabled: Story = { args: { variant: "primary", disabled: true } };
