import { readFileSync, writeFileSync } from 'node:fs';

const updates = [
  {
    workflow: 'n8n/06-generate-article.json',
    node: 'Prepare Article Generation Request',
    prompt: 'prompts/article-generation-master-prompt.md',
    pattern: /const masterPrompt = "(?:\\.|[^"\\])*";/,
    replacement: (value) => `const masterPrompt = ${JSON.stringify(value)};`,
  },
  {
    workflow: 'n8n/10-revise-article-from-doctor-feedback.json',
    node: 'Prepare Revision Request',
    prompt: 'prompts/article-revision-master-prompt.md',
    pattern: /instructions: "(?:\\.|[^"\\])*",/,
    replacement: (value) => `instructions: ${JSON.stringify(value)},`,
  },
];

for (const { workflow, node, prompt, pattern, replacement } of updates) {
  const data = JSON.parse(readFileSync(workflow, 'utf8'));
  const target = data.nodes.find((entry) => entry.name === node);
  if (!target) throw new Error(`${workflow}: missing ${node}`);
  const matches = target.parameters.jsCode.match(pattern);
  if (!matches) throw new Error(`${workflow}: prompt assignment not found`);
  const next = target.parameters.jsCode.replace(pattern, replacement(readFileSync(prompt, 'utf8')));
  if (next === target.parameters.jsCode) continue;
  target.parameters.jsCode = next;
  writeFileSync(workflow, `${JSON.stringify(data, null, 2)}\n`);
}
