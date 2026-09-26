import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function renderWorkflowMap(definition) {
  const lines = ['flowchart LR'];
  const waitingStages = new Set();
  const terminalStages = new Set();
  for (const stage of Object.values(definition.stages)) {
    for (const transition of Object.values(stage.transitions ?? {})) {
      if (transition.waitForHuman) waitingStages.add(transition.to);
      if (transition.terminal) terminalStages.add(transition.to);
    }
  }
  for (const [stageId, stage] of Object.entries(definition.stages)) {
    const state = terminalStages.has(stageId) ? 'COMPLETE'
      : waitingStages.has(stageId) ? 'WAITING FOR HUMAN'
        : stageId === definition.initialStage ? 'START' : null;
    lines.push(`    ${stageId}["${stageId}<br/>${stage.role}${state ? `<br/>${state}` : ''}"]`);
  }
  for (const [stageId, stage] of Object.entries(definition.stages)) {
    for (const [event, transition] of Object.entries(stage.transitions ?? {})) {
      const label = transition.visualLabel ?? (transition.terminal
        ? `${event} · terminal`
        : (transition.waitForHuman ? `${event} · wait for human` : event));
      lines.push(`    ${stageId} -->|${label}| ${transition.to}`);
    }
  }
  lines.push('    classDef start fill:#dbeafe,stroke:#2563eb,color:#1e3a8a');
  lines.push('    classDef waiting fill:#fef3c7,stroke:#d97706,color:#78350f');
  lines.push('    classDef done fill:#dcfce7,stroke:#16a34a,color:#14532d');
  lines.push(`    class ${definition.initialStage} start`);
  for (const stageId of waitingStages) lines.push(`    class ${stageId} waiting`);
  for (const stageId of terminalStages) lines.push(`    class ${stageId} done`);
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
