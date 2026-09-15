const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "../src");

test("each named component has separate code, template, and styles", () => {
  const folders = [
    "controller-header",
    "profile-selector",
    "server-list",
    "server-details",
    "connector-logs",
  ];
  for (const folder of folders) {
    const base = path.join(
      root,
      "app/components",
      folder,
      `${folder}.component`,
    );
    for (const extension of ["ts", "html", "css"])
      assert.ok(fs.existsSync(`${base}.${extension}`));
    const code = fs.readFileSync(`${base}.ts`, "utf8");
    assert.match(code, /templateUrl:/);
    assert.match(code, /styleUrl:/);
    assert.doesNotMatch(code, /template\s*:/);
  }
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "main.ts"), "utf8"),
    /@Component|prototype/,
  );
});

test("server actions and details retain status bindings", () => {
  const list = fs.readFileSync(
    path.join(root, "app/components/server-list/server-list.component.html"),
    "utf8",
  );
  assert.match(list, /\[disabled\]="s.connectorDetected"/);
  assert.match(list, /\[disabled\]="!s.connectorDetected"/);
  const details = fs.readFileSync(
    path.join(
      root,
      "app/components/server-details/server-details.component.html",
    ),
    "utf8",
  );
  for (const field of [
    "serverOnline",
    "originHealthy",
    "connectorDetected",
    "accessHealthy",
  ]) {
    assert.ok(details.includes(`[class.ok]="s.${field}"`));
    assert.ok(details.includes(`[class.bad]="!s.${field}"`));
  }
});

async function loadFilter() {
  const source = fs.readFileSync(
    path.join(root, "app/utils/log-filter.ts"),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
}

test("log search and server filters combine without modifying colored tokens", async () => {
  const { filterLogs } = await loadFilter();
  const lines = [
    [
      { text: "[example-node-a] ", kind: "server" },
      { text: "INF connected", kind: "info" },
    ],
    [{ text: "[example-node-b] ERR timeout", kind: "error" }],
    [{ text: "[example-node-a] ERR <script>timeout</script>", kind: "error" }],
  ];
  assert.equal(filterLogs(lines, "", ""), lines);
  assert.deepEqual(filterLogs(lines, " TIMEOUT ", ""), [lines[1], lines[2]]);
  assert.deepEqual(filterLogs(lines, "", "example-node-a"), [
    lines[0],
    lines[2],
  ]);
  assert.deepEqual(filterLogs(lines, "timeout", "example-node-a"), [lines[2]]);
  assert.deepEqual(filterLogs(lines, "absent", ""), []);
  assert.equal(
    lines[2][0].text,
    "[example-node-a] ERR <script>timeout</script>",
  );
  const template = fs.readFileSync(
    path.join(
      root,
      "app/components/connector-logs/connector-logs.component.html",
    ),
    "utf8",
  );
  assert.match(template, /{{\s*token\.text\s*}}/);
  assert.doesNotMatch(template, /innerHTML/);
});
