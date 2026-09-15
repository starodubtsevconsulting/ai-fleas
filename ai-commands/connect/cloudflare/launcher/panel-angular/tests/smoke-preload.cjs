const { contextBridge } = require("electron");
const targets = [
  {
    providerId: "example-node-a",
    serverOnline: true,
    originHealthy: true,
    connectorDetected: true,
    connectorManaged: true,
    accessHealthy: true,
    publicUrl: "https://a.example.invalid",
  },
  {
    providerId: "example-node-b",
    serverOnline: false,
    originHealthy: false,
    connectorDetected: false,
    connectorManaged: false,
    accessHealthy: false,
  },
];
contextBridge.exposeInMainWorld("cloudflareTunnel", {
  contexts: async () => ({
    contexts: [{ profileId: "example", workflow: "dev.workflow.md" }],
    selected: { profileId: "example", workflow: "dev.workflow.md" },
  }),
  targets: async () => targets,
  logs: async () => [
    "[example-node-a] INF connected",
    "[example-node-b] ERR timeout",
    "[example-node-a] WARN retry",
  ],
  onLog: () => {},
  start: async () => {},
  stop: async () => {},
  openPublicUrl: async () => {},
  selectContext: async () => ({ targets }),
});
