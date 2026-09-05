import assert from 'node:assert/strict';
import fs from 'node:fs';

const markdownPath = process.argv[2];
const htmlPath = process.argv[3];
assert.ok(markdownPath && htmlPath, 'Expected generated Markdown and HTML paths.');

const markdown = fs.readFileSync(markdownPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

const diagramPosition = markdown.indexOf('```mermaid');
const diagramDescriptionPosition = markdown.indexOf('## Diagram description');
const descriptionPosition = markdown.indexOf('## What this review does');
const rulesPosition = markdown.indexOf('## Modified Markdown rules');
const decisionPosition = markdown.indexOf('## Human review');
assert.ok(diagramPosition >= 0);
assert.ok(diagramPosition < diagramDescriptionPosition);
assert.ok(diagramDescriptionPosition < descriptionPosition);
assert.ok(descriptionPosition < rulesPosition);
assert.ok(rulesPosition < decisionPosition);

assert.match(markdown, /````markdown\n[\s\S]*```mermaid\n[\s\S]*```\n[\s\S]*````/);
assert.match(markdown, /#### Rendered diagrams\n\n##### Diagram 1\n\n```mermaid/);
assert.match(markdown, /- \[ \].*exact current Markdown reviewed/);
assert.match(markdown, /- \[ \].*every rendered diagram preview reviewed/);
assert.match(markdown, /- \[ \].*complete diff against `HEAD` reviewed/);
assert.equal((html.match(/<div class="diagram-block">/g) ?? []).length, 2);
assert.equal((html.match(/<div class="mermaid">/g) ?? []).length, 2);
assert.equal((html.match(/class="language-markdown"/g) ?? []).length, 1);
assert.doesNotMatch(html, /<p>\s*flowchart TD\s*<\/p>/);

const markdownBlock = html.match(/<code class="language-markdown"[^>]*>([\s\S]*?)<\/code>/);
assert.ok(markdownBlock, 'Expected one annotated Markdown source block.');
const visibleSource = markdownBlock[1].replace(/<[^>]+>/g, '');
assert.match(visibleSource, /```mermaid/);
assert.match(visibleSource, /flowchart TD/);

const diagrams = [...markdown.matchAll(/^```mermaid\s*\n([\s\S]*?)^```\s*$/gm)].map((match) => match[1]);
assert.ok(diagrams.length >= 2, 'Expected the report diagram and a rendered source-diagram preview.');
for (const diagram of diagrams) {
  assert.match(diagram, /^flowchart TD\s*$/m);
  assert.doesNotMatch(diagram, /^flowchart (?:LR|RL|BT)\s*$/m);
  assert.match(diagram, /-->/);
  assert.equal((diagram.match(/"/g) ?? []).length % 2, 0, 'Mermaid quotes must be balanced.');
  assert.equal((diagram.match(/\[/g) ?? []).length, (diagram.match(/\]/g) ?? []).length, 'Mermaid brackets must balance.');
}

console.log('show-context rendering unit tests passed');
