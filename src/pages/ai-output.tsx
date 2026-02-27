import React from "react";
import { Button } from "../components/Button";

export default function AIOutput() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>AI Output Playground</h1>
      <p style={{ opacity: 0.7 }}>
        이 페이지는 AI가 자유롭게 컴포넌트를 조합하는 공간입니다. (tokens/components는 수정 금지)
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="invisible">Invisible</Button>
        <Button variant="primary" disabled>Disabled</Button>
      </div>
    </main>
  );
}
