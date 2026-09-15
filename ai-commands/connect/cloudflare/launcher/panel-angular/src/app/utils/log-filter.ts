import { LogToken } from "../models";
export function filterLogs(
  lines: LogToken[][],
  search: string,
  serverId: string,
): LogToken[][] {
  const query = search.trim().toLowerCase();
  const server = serverId ? `[${serverId}]`.toLowerCase() : "";
  if (!query && !server) return lines;
  return lines.filter((tokens) => {
    const line = tokens
      .map((token) => token.text)
      .join("")
      .toLowerCase();
    return (
      (!server || line.includes(server)) && (!query || line.includes(query))
    );
  });
}
