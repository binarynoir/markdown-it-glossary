export interface GlossaryTooltipOptions {
  /**
   * CSS selector for the elements that carry a definition in their
   * `title` attribute. Default: `"abbr[title]"`.
   */
  selector?: string;
  /**
   * Show the popover when the mouse hovers a term, in addition to click
   * and tap. Set to `false` for click/tap only. Default: `true`.
   */
  hover?: boolean;
  /**
   * Only respond to touch input (touch screens), leaving mouse users with
   * the browser's native `title` tooltip. Default: `false`.
   */
  touchOnly?: boolean;
  /**
   * Inject the default popover styles. Set to `false` to style
   * `.glossary-popover` yourself. Default: `true`.
   */
  injectStyles?: boolean;
}

const STYLE_ID = "glossary-popover-style";

// Colors fall back to VitePress theme variables, then to neutral values,
// and can be overridden with --glossary-popover-bg / -fg / -border.
const CSS = `
.glossary-popover {
  position: absolute;
  z-index: 1000;
  box-sizing: border-box;
  max-width: min(20rem, calc(100vw - 1.5rem));
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--glossary-popover-border, var(--vp-c-divider, #d0d0d0));
  border-radius: 8px;
  background: var(--glossary-popover-bg, var(--vp-c-bg-elv, #fff));
  color: var(--glossary-popover-fg, var(--vp-c-text-1, #222));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  font-size: 0.875rem;
  line-height: 1.4;
}
`;

/**
 * Shows glossary definitions in a small popover that works with every
 * kind of input, instead of relying on `<abbr title>`'s native tooltip
 * (which needs a mouse hover, so it never appears on touch screens).
 *
 * - **Mouse:** hover a term to show it; click to pin it open.
 * - **Touch:** tap a term to show it.
 * - Tap the term again, tap elsewhere, scroll, or press Escape to dismiss.
 *
 * While a popover is open the term's `title` is removed so the browser's
 * own tooltip doesn't show on top of it, then restored on close. Call
 * once in the browser — in VitePress, from your theme's `enhanceApp`.
 *
 * ```ts
 * // .vitepress/theme/index.ts
 * import DefaultTheme from "vitepress/theme";
 * import { enableGlossaryTooltips } from "markdown-it-glossary/client";
 *
 * export default {
 *   extends: DefaultTheme,
 *   enhanceApp() {
 *     enableGlossaryTooltips();
 *   },
 * };
 * ```
 *
 * Returns a function that removes the listeners and any open popover.
 * Safe to call during SSR — it does nothing without a `document`.
 */
export function enableGlossaryTooltips(options: GlossaryTooltipOptions = {}): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};

  const {
    selector = "abbr[title]",
    hover = true,
    touchOnly = false,
    injectStyles = true,
  } = options;

  // `pointer: coarse` catches iPads in "desktop site" mode, which can
  // report a hover-capable primary input despite being touch-only.
  const isTouchDevice = (): boolean =>
    window.matchMedia("(hover: none), (pointer: coarse)").matches;

  // Decided per event, not once at load: the device can change (DevTools
  // emulation, a tablet docked to a mouse), and the event itself says
  // what kind of pointer it came from.
  const allowed = (event: Event): boolean =>
    !touchOnly || isTouchDevice() || (event as PointerEvent).pointerType === "touch";

  let style: HTMLStyleElement | null = null;
  const injectStyle = (): void => {
    if (style || document.getElementById(STYLE_ID)) return;
    style = document.createElement("style");
    style.id = STYLE_ID;
    // iOS Safari only dispatches `click` for elements it considers
    // clickable, which a bare <abbr> isn't — `cursor: pointer` opts it in, so
    // this is injected even with `injectStyles: false`. Forced because themes
    // often set `cursor: help` here.
    style.textContent = `${selector} {\n  cursor: pointer !important;\n  -webkit-tap-highlight-color: transparent;\n}\n${injectStyles ? CSS : ""}`;
    document.head.appendChild(style);
  };

  if (!touchOnly || isTouchDevice()) injectStyle();

  let popover: HTMLElement | null = null;
  let anchor: Element | null = null;
  let pinned = false;
  // Definitions of terms whose `title` is lifted while their popover is open.
  const lifted = new Map<Element, string>();

  const restoreTitle = (): void => {
    for (const [el, text] of lifted) el.setAttribute("title", text);
    lifted.clear();
  };

  const close = (): void => {
    popover?.remove();
    popover = null;
    anchor = null;
    pinned = false;
    restoreTitle();
  };

  const open = (target: Element, text: string): void => {
    close();
    anchor = target;
    target.removeAttribute("title");
    lifted.set(target, text);

    const el = document.createElement("div");
    el.className = "glossary-popover";
    el.setAttribute("role", "tooltip");
    el.textContent = text;
    // Measure before placing: hidden but laid out.
    el.style.visibility = "hidden";
    document.body.appendChild(el);

    const rect = target.getBoundingClientRect();
    const margin = 8;
    const docWidth = document.documentElement.clientWidth;
    const left = Math.min(
      Math.max(rect.left + window.scrollX + rect.width / 2 - el.offsetWidth / 2, margin),
      Math.max(margin, docWidth - el.offsetWidth - margin) + window.scrollX,
    );
    // Prefer above the term; flip below when there isn't room.
    const above = rect.top - el.offsetHeight - margin;
    const top = above >= margin ? above : rect.bottom + margin;

    el.style.left = `${left}px`;
    el.style.top = `${top + window.scrollY}px`;
    el.style.visibility = "";
    popover = el;
  };

  // The term under an event. A term whose title is lifted no longer
  // matches `selector`, so the open anchor is matched by containment.
  const termFor = (event: Event): Element | null => {
    const node = event.target as Element | null;
    if (anchor && node && anchor.contains(node)) return anchor;
    return node?.closest?.(selector) ?? null;
  };

  const textFor = (term: Element): string | null =>
    term.getAttribute("title") ?? lifted.get(term) ?? null;

  const onClick = (event: Event): void => {
    if (!allowed(event)) return;
    injectStyle();
    const term = termFor(event);
    if (!term) {
      close();
      return;
    }
    // Clicking an already-pinned term toggles it off; clicking a term that
    // is only showing because of hover pins it open instead.
    if (term === anchor) {
      if (pinned) close();
      else pinned = true;
      return;
    }
    const text = textFor(term);
    if (!text) return;
    // A term inside a link shouldn't navigate on the tap that reveals it.
    event.preventDefault();
    open(term, text);
    pinned = true;
  };

  const onPointerOver = (event: Event): void => {
    // Touch and pen also emit pointer-over just before a tap; only a real
    // mouse hover should open on its own.
    if ((event as PointerEvent).pointerType !== "mouse" || touchOnly || pinned) return;
    const term = termFor(event);
    if (!term || term === anchor) return;
    const text = textFor(term);
    if (text) open(term, text);
  };

  const onPointerOut = (event: Event): void => {
    if ((event as PointerEvent).pointerType !== "mouse" || pinned || !anchor) return;
    const next = (event as PointerEvent).relatedTarget as Node | null;
    if (next && anchor.contains(next)) return;
    close();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", close, { passive: true });
  if (hover) {
    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
  }

  return () => {
    close();
    document.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", close);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
  };
}
