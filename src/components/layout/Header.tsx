import type { ReactNode } from "react";

export function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
      <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-4">{children}</div>
    </header>
  );
}
