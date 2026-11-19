/**
 * Companion chat on Netlify: the same server step as the Cloudflare Worker,
 * served at /api/chat on the site itself (so the prototype needs no extra
 * address). Set ANTHROPIC_API_KEY in Netlify's environment variables; without
 * it the chat answers in demo mode.
 *
 *   POST /api/chat  { "messages": [{ "role": "user" | "assistant", "content": "..." }] }
 *   → 200 text/plain stream of the companion's reply
 */
import { readMessages, replyStream, TEXT_HEADERS } from "../../worker/src/chat"

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return new Response("Not found", { status: 404 })

  // Only this site may use it: a browser always sends Origin on a POST.
  const origin = request.headers.get("Origin")
  const self = new URL(request.url).origin
  const extra = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean)
  if (origin && origin !== self && !extra.includes(origin)) {
    return new Response("This site isn't allowed to use the companion.", { status: 403 })
  }

  const messages = await readMessages(request)
  if (!messages) return new Response("Bad request", { status: 400 })

  return new Response(replyStream(process.env.ANTHROPIC_API_KEY, process.env.MODEL, messages), { headers: TEXT_HEADERS })
}

export const config = { path: "/api/chat" }
