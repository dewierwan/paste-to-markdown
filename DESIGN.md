# Design philosophy

Paste Into follows the design language of [iA](https://ia.net/), the makers of iA Writer. The sibling project email-drafter uses the same language and the same tokens. Read this before changing anything visual: CSS, layout, copy on the page, icons or store images.

## Where it comes from

- [iA](https://ia.net/): the whole site is the reference. Mostly black, white and grey, a lot of white space, plain and direct copy.
- [The web is all about typography, period](https://ia.net/topics/the-web-is-all-about-typography-period): almost everything on a page is text, so good design is mostly good typography. What matters is how you use a typeface, not how many you use.
- [iA Writer](https://ia.net/writer): "every feature earns its place". No buttons, popups or settings that are not needed. Good defaults instead of options.
- [Making icons fresh](https://ia.net/topics/making-icons-fresh): "simple is never easy". One literal object per icon, no shadows, blurs or glitz.

## Principles

1. **Reduce.** Remove anything that does not help someone paste, pick an output and copy. If a control, label or line can go, it goes.
2. **Typography first.** Hierarchy comes from size, weight and spacing, not from boxes, colour or icons. Inter for the interface, iA Writer Mono for Markdown and code.
3. **Quiet surfaces.** Warm grey paper, white cards, hairline rules and very soft shadows. No gradients or decoration.
4. **One accent, used sparingly.** Blue marks the current state and small labels: the selected output and the caret. It is never a big fill.
5. **Plain words.** Short, direct copy that says what happens ("The result is copied automatically").
6. **Legible over clever.** Every symbol should be recognisable at a glance. Avoid abstract or decorative marks.

## Tokens

These live in `css/app.css` and match email-drafter's `extension/sidepanel.css`.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F7F7F7` | Page background |
| `--card` | `#FFFFFF` | Cards |
| `--rule` / `--rule-soft` | `#EAEAEA` / `#F0F0F0` | Hairlines |
| `--ink` | `#222222` | Text |
| `--ink-muted` / `--ink-subtle` | `#555555` / `#888888` | Secondary text |
| `--accent` | `#0080FF` | Selected state, focus (iA blue) |
| `--font-sans` | Inter | Interface |
| `--font-mono` | iA Writer Mono | Markdown output |

## Icons and brand marks

- Keep the favicon and extension icon monochrome (ink and paper), with at most a small accent. Never a solid blue tile: they are not BlueDot branding.
- Use one simple, literal symbol per icon. It must still be readable at 16×16 px, so use heavy strokes and generous padding, and check it at real size.
- No gradients, shadows, 3D, texture or extra text.
