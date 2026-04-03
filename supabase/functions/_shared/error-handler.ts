import { corsHeaders } from "./cors.ts";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function handleError(error: unknown): Response {
  console.error("API Error execution:", error);

  if (error instanceof ApiError) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
