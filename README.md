# NVA prototype · React

Flow 1e (photo-first intake, screens IS00–IS09) from the Claude Design canvas
"NVA 2103 - Waffles 2.0", built with Vite, React and shadcn/ui.

## Run it

```bash
npm install
npm run dev
```

Screens live at `#/is00` … `#/is09`.

## How it's put together

- `src/styles/tokens.css`: the Syrup Design System tokens, copied unchanged from
  the canvas (`ds/shad/tokens.css`). They are the shadcn theme; `src/index.css`
  only maps them to Tailwind.
- `src/components/ui/`: shadcn components. Button (large size, outline shadow)
  and Switch (large size) are adjusted to match Syrup.
- `src/flow1e/`: the flow. `parts.tsx` holds shared pieces (hero, top bar, sheet,
  profile card), `screens/` holds one file per screen, `flow1e.css` holds the
  surfaces and motion that aren't in the design system yet.

## Workflow

- Work on a branch, open a pull request. CI type-checks and builds every PR.
- The design canvas is the starting point, not a live source: changes made here
  don't flow back to Claude Design.
- `Deploy to GitHub Pages` runs by hand from the Actions tab.
