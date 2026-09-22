import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function renderWorkflowMap(definition) {
  const lines = ['flowchart LR'];
  for (const [stageId, stage] of Object.entries(definition.stages)) {
    lines.push(`    ${stageId}["${stageId}<br/>${stage.role}"]`);
  }
  for (const [stageId, stage] of Object.entries(definition.stages)) {
    for (const [event, transition] of Object.entries(stage.transitions ?? {})) {
      const label = transition.terminal
        ? `${event} · terminal`
        : (transition.waitForHuman ? `${event} · wait for human` : event);
      lines.push(`    ${stageId} -->|${label}| ${transition.to}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    process.stderr.write('usage: node workflow-map.mjs <workflow-map.json> <workflow-map.mmd>\n');
    process.exit(1);
  }
  const definition = JSON.parse(fs.readFileSync(input, 'utf8'));
  fs.writeFileSync(output, renderWorkflowMap(definition));
}
