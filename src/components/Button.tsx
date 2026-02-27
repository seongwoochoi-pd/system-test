import React from "react";
import { resolveToken } from "../lib/token";

type Variant = "primary" | "secondary" | "danger" | "invisible";
type State = "rest" | "hover" | "active" | "disabled";

function t(variant: Variant, property: "background" | "border" | "foreground", state: State) {
  return resolveToken(`color.component.button.${variant}.${property}.${state}`);
}

export function Button(props: {
  variant?: Variant;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const variant = props.variant ?? "primary";
  const state: State = props.disabled ? "disabled" : "rest";

  const background = t(variant, "background", state);
  const border = t(variant, "border", state);
  const color = t(variant, "foreground", state);

  return (
    <button
      disabled={props.disabled}
      style={{
        background,
        color,
        border: `1px solid ${border}`,
        padding: "10px 14px",
        borderRadius: 10,
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
      }}
    >
      {props.children}
    </button>
  );
}
