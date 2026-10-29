// Tool registry types for the Hanguk AI agent.
//
// Who may call a tool is decided HERE (audiences), not in the prompt: a student
// conversation is simply never offered a staff tool. The RPCs behind the tools
// check auth.uid() again in Postgres, so a mistake in either layer alone does
// not open data.
//
// deno-lint-ignore-file no-explicit-any

export type Audience = "staff" | "student" | "guest";

export interface Caller {
  audience: Audience;
  /** auth.users id; null for a guest. */
  userId: string | null;
  name: string;
  roles: string[];
  /** Guests: the app install id, or a hash of the IP. Used for limits only. */
  guestKey: string | null;
}

/** A knowledge source the answer can cite (guideline, PDF page, web page). */
export interface Source {
  kind: "guideline" | "pdf" | "web" | "crm";
  label: string;
  url?: string | null;
  page?: string | null;
  date?: string | null;
}

export interface ToolCtx {
  /** Supabase client acting AS the caller (their JWT); service client for guests. */
  user: any;
  /** Service-role client: used only where a tool documents why. */
  service: any;
  caller: Caller;
  language: string;
}

export interface ToolResult {
  data: unknown;
  sources?: Source[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  audiences: Audience[];
  /** Only staff with one of these roles get the tool (e.g. query_database). */
  roles?: string[];
  run(ctx: ToolCtx, args: any): Promise<ToolResult>;
}

/** OpenAI-style declaration for the provider. */
export function declare(t: AgentTool) {
  return { type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } };
}

export function toolsFor(all: AgentTool[], caller: Caller): AgentTool[] {
  return all.filter((t) =>
    t.audiences.includes(caller.audience) &&
    (!t.roles || t.roles.some((r) => caller.roles.includes(r)))
  );
}

/** Wraps an RPC call: errors come back as {error} so the model can report them. */
export async function rpc(client: any, fn: string, params: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.rpc(fn, params);
  return error ? { error: error.message } : data;
}
