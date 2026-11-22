import type { CodingProject } from "../types/jarvis";

export function buildSingleFileHtml(project: CodingProject): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.name)}</title>
  <meta name="description" content="${escapeHtml(project.description)}" />
  <style>
${project.css}
  </style>
</head>
<body>
${project.html}
  <script>
${project.js}
  </script>
</body>
</html>`;
}

export function downloadTextFile(filename: string, content: string, mime = "text/html") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
