/**
 * Companion chat on Cloudflare: a tiny Worker between the prototype and Claude.
 *
 * The prototype is static files, so it can't hold the AI key. This Worker
 * holds it as a secret; the shared logic lives in ./chat.ts (the Netlify
 * Function uses the same file).
 *
 *   POST /chat  { "messages": [{ "role": "user" | "assistant", "content": "..." }] }
 *   → 200 text/plain stream of the companion's reply
 */
import { readMessages, replyStream, TEXT_HEADERS } from "./chat"

interface Env {
  ANTHROPIC_API_KEY?: string
  /** Comma-separated list of sites allowed to call this Worker. */
  ALLOWED_ORIGINS: string
  /** Claude model id, e.g. claude-opus-5-5 */
  MODEL: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? ""
    const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    const cors: Record<string, string> = allowed.includes(origin)
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : {}

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: allowed.includes(origin) ? 204 : 403,
        headers: { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" },
      })
    }

    const url = new URL(request.url)
    if (request.method !== "POST" || url.pathname !== "/chat") {
      return new Response("Not found", { status: 404 })
    }
    // Browsers always send Origin on cross-site POSTs; block other sites.
    if (origin && !allowed.includes(origin)) {
      return new Response("This site isn't allowed to use the companion.", { status: 403 })
    }

    const messages = await readMessages(request)
    if (!messages) return new Response("Bad request", { status: 400, headers: cors })

    return new Response(replyStream(env.ANTHROPIC_API_KEY, env.MODEL, messages), { headers: { ...cors, ...TEXT_HEADERS } })
  },
} satisfies ExportedHandler<Env>
