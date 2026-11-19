/**
 * Companion chat: a tiny Cloudflare Worker between the prototype and Claude.
 *
 * The prototype is static files (GitHub Pages), so it can't hold the AI key.
 * This Worker holds it as a secret, checks each request, asks Claude, and
 * streams the reply back as plain text, word by word.
 *
 *   POST /chat  { "messages": [{ "role": "user" | "assistant", "content": "..." }] }
 *   → 200 text/plain stream of the companion's reply
 *
 * Without an ANTHROPIC_API_KEY secret it answers in demo mode with a canned
 * reply, so the plumbing can be tested without spending anything.
 */
import Anthropic from "@anthropic-ai/sdk"
import { COMPANION_BRIEF } from "./companion"

interface Env {
  ANTHROPIC_API_KEY?: string
  /** Comma-separated list of sites allowed to call this Worker. */
  ALLOWED_ORIGINS: string
  /** Claude model id, e.g. claude-opus-5-5 */
  MODEL: string
}

// Guard rails so a public link can't run up a large bill.
const MAX_TURNS = 20 // messages per conversation
const MAX_CHARS = 1500 // per message
const MAX_REPLY_TOKENS = 1200

type Turn = { role: "user" | "assistant"; content: string }

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
    if (!messages) {
      return new Response("Bad request", { status: 400, headers: cors })
    }

    const headers = { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(demoReply(messages), { headers })
    }

    return new Response(claudeReply(env, messages), { headers })
  },
} satisfies ExportedHandler<Env>

/** Accept only a short, well-formed conversation that ends with the user. */
async function readMessages(request: Request): Promise<Turn[] | null> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return null
  }
  const list = (body as { messages?: unknown })?.messages
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_TURNS) return null

  const turns: Turn[] = []
  for (const [i, m] of list.entries()) {
    const role = (m as Turn)?.role
    const content = (m as Turn)?.content
    const expected = i % 2 === 0 ? "user" : "assistant"
    if (role !== expected || typeof content !== "string") return null
    const text = content.trim().slice(0, MAX_CHARS)
    if (!text) return null
    turns.push({ role, content: text })
  }
  return turns.at(-1)?.role === "user" ? turns : null
}

/** Ask Claude and stream the text of its reply. */
function claudeReply(env: Env, messages: Turn[]): ReadableStream<Uint8Array> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = client.beta.messages.stream({
          model: env.MODEL,
          max_tokens: MAX_REPLY_TOKENS,
          // Chat: short, friendly replies, so low effort keeps it quick.
          output_config: { effort: "low" },
          // If a safety check declines, let the API retry on a fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: COMPANION_BRIEF, cache_control: { type: "ephemeral" } }],
          messages,
        })

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        const final = await stream.finalMessage()
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\nI can't help with that one here. For anything about Waffles' health, Dr. Ruiz's team is the best people to ask."))
        }
      } catch (err) {
        const status = err instanceof Anthropic.APIError ? err.status : "network"
        console.error("Claude request failed", status, err)
        controller.enqueue(encoder.encode("Sorry, I couldn't answer just now. Please try again in a moment."))
      } finally {
        controller.close()
      }
    },
  })
}

/** Canned reply, streamed word by word, used when no AI key is set. */
function demoReply(messages: Turn[]): ReadableStream<Uint8Array> {
  const question = messages.at(-1)!.content
  const reply = `Demo mode (no AI key set yet). You asked: "${question}". Once the key is added, I'll answer this properly, knowing Waffles is a 12-week Golden Retriever with her second puppy shots on Tuesday.`
  const words = reply.split(/(?<= )/)
  const encoder = new TextEncoder()
  return new ReadableStream({
    async pull(controller) {
      const next = words.shift()
      if (next === undefined) return controller.close()
      await new Promise((r) => setTimeout(r, 35))
      controller.enqueue(encoder.encode(next))
    },
  })
}
