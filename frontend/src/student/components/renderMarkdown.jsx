import React from "react";

/**
 * Lightweight Markdown renderer — no external dependency.
 * Supports: headings (# ##), bold (**), italic (*), inline code (`),
 * fenced code blocks (```), unordered lists (-), ordered lists (1.),
 * pipe tables (|), and paragraph text.
 */
export default function renderMarkdown(raw) {
  const lines  = raw.split("\n");
  const output = [];
  let inPre = false, preLines = [];

  const flush = () => {
    output.push(
      <pre key={`pre-${output.length}`}>
        <code dangerouslySetInnerHTML={{ __html: preLines.join("\n") }} />
      </pre>
    );
    preLines = []; inPre = false;
  };

  const inline = (str) =>
    str
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");

  let tableRows = [], inTable = false;
  const flushTable = () => {
    if (!tableRows.length) return;
    const [header, , ...body] = tableRows;
    const ths = header.split("|").filter(Boolean).map(h => h.trim());
    const trs = body.map((row, ri) => {
      const tds = row.split("|").filter(Boolean).map(c => c.trim());
      return (
        <tr key={ri}>
          {tds.map((td, ci) => <td key={ci} dangerouslySetInnerHTML={{ __html: inline(td) }} />)}
        </tr>
      );
    });
    output.push(
      <table key={`tbl-${output.length}`}>
        <thead><tr>{ths.map((th, i) => <th key={i}>{th}</th>)}</tr></thead>
        <tbody>{trs}</tbody>
      </table>
    );
    tableRows = []; inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) { if (inPre) flush(); else inPre = true; continue; }
    if (inPre) { preLines.push(line); continue; }
    if (line.startsWith("|")) { inTable = true; tableRows.push(line); continue; }
    if (inTable) flushTable();
    if      (line.startsWith("## ")) output.push(<h2 key={i} dangerouslySetInnerHTML={{ __html: inline(line.slice(3)) }} />);
    else if (line.startsWith("# "))  output.push(<h2 key={i} style={{ fontSize: 20 }} dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} />);
    else if (line.startsWith("- "))  output.push(<ul key={i}><li dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} /></ul>);
    else if (/^\d+\. /.test(line))   output.push(<ol key={i}><li dangerouslySetInnerHTML={{ __html: inline(line.replace(/^\d+\. /, "")) }} /></ol>);
    else if (line.trim() === "")     output.push(<div key={i} style={{ height: 5 }} />);
    else output.push(<p key={i} dangerouslySetInnerHTML={{ __html: inline(line) }} />);
  }
  if (inTable) flushTable();
  if (inPre)   flush();
  return output;
}
