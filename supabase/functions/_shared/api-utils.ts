import { ApiError } from "./error-handler.ts";

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      // Successfully processed (even if 4xx aside from 429, we let the caller handle it)
      if (response.status !== 429 && response.status !== 503) {
        return response;
      }

      lastResponse = response;

      // If rate limited or service unavailable, wait and retry
      if ((response.status === 429 || response.status === 503) && i < maxRetries - 1) {
        let delay = Math.pow(2, i) * 1000 + (Math.random() * 500); // Exponential backoff + jitter
        
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          const parsedRetry = parseInt(retryAfter, 10);
          if (!isNaN(parsedRetry)) {
            delay = parsedRetry * 1000;
          }
        }
        
        console.warn(`[Retry ${i + 1}/${maxRetries}] Status ${response.status} from ${url}. Waiting ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // If we reach here, we're at the final retry and it's a 429/503
      return response;
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + (Math.random() * 500);
        console.warn(`[Retry ${i + 1}/${maxRetries}] Network error: ${lastError.message}. Waiting ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new ApiError(500, "Max retries exceeded");
}
