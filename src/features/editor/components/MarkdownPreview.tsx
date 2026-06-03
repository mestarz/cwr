import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";
import Markdown, { type Components } from "react-markdown";

type MarkdownPreviewProps = {
  markdown: string;
};

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  return <Markdown components={components}>{markdown}</Markdown>;
}

const components: Components = {
  code({ className, children }) {
    const source = String(children).trim();

    if (className === "language-mermaid") {
      return <MermaidBlock chart={source} />;
    }

    return <code className={className}>{children}</code>;
  }
};

function MermaidBlock({ chart }: { chart: string }) {
  const id = useId().replaceAll(":", "");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        primaryColor: "#ecfdf5",
        primaryTextColor: "#134e4a",
        lineColor: "#64748b"
      }
    });

    mermaid.render(`emma-diagram-${id}`, chart).then((result) => setSvg(result.svg));
  }, [chart, id]);

  return <div className="mermaid-render" dangerouslySetInnerHTML={{ __html: svg }} />;
}
