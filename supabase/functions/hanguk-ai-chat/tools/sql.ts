// query_database — owner/admin only. Lives in its own file because it imports
// the Deno Postgres driver (analytics.ts), which the node test runner cannot load.
import { QUERY_TOOL, runReadOnlyQuery } from "../analytics.ts";
import type { AgentTool } from "./types.ts";

export const SQL_TOOL: AgentTool = {
  name: QUERY_TOOL.function.name,
  description: QUERY_TOOL.function.description,
  parameters: QUERY_TOOL.function.parameters,
  audiences: ["staff"],
  roles: ["owner", "admin"],
  run: async (_ctx, a) => ({ data: await runReadOnlyQuery(a?.sql) }),
};
