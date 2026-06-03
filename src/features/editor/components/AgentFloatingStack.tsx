import { Network, Sparkles } from "lucide-react";
import type { AgentFloatingWidget } from "../../../domain/agent";
import { MarkdownPreview } from "./MarkdownPreview";

type AgentFloatingStackProps = {
  widgets: AgentFloatingWidget[];
};

export function AgentFloatingStack({ widgets }: AgentFloatingStackProps) {
  if (widgets.length === 0) {
    return null;
  }

  return (
    <aside className="agent-floating-stack">
      {widgets.map((widget) => (
        <section className={widget.kind === "markdown" ? "floating-widget floating-widget-markdown" : "floating-widget"} key={widget.id}>
          <div className="floating-widget-title">
            {widget.kind === "explanation" ? <Sparkles size={16} /> : <Network size={16} />}
            <span>{widget.title}</span>
          </div>
          {widget.kind === "markdown" ? (
            <div className="markdown-body">
              <MarkdownPreview markdown={widget.content} />
            </div>
          ) : (
            <p>{widget.content}</p>
          )}
        </section>
      ))}
    </aside>
  );
}
