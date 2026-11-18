// Folds dist-artifact into one page for a claude.ai Artifact: the CSS and JS
// go inline, and the doctype/html/head/body wrapper is dropped because the
// Artifact tool adds its own.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const dir = "dist-artifact"
const html = readFileSync(join(dir, "artifact.html"), "utf8")
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\/([^"]+)"[^>]*>/g)].map((m) => readFileSync(join(dir, m[1]), "utf8"))
const js = [...html.matchAll(/<script type="module"[^>]*src="\/([^"]+)"[^>]*><\/script>/g)].map((m) => readFileSync(join(dir, m[1]), "utf8"))
const title = html.match(/<title>.*?<\/title>/)[0]

// "</script" inside the bundle would end the inline tag early.
const safe = (s) => s.replace(/<\/script/gi, "<\\/script")

const page = `${title}
<style>:root{color-scheme:light}body{background:var(--background,#fff)}</style>
<style>${css.join("\n")}</style>
<div id="root"></div>
<script type="module">${safe(js.join("\n"))}</script>
`
writeFileSync(join(dir, "companion.html"), page)
console.log(`Wrote ${join(dir, "companion.html")} (${(page.length / 1024).toFixed(0)} KB)`)
