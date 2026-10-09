export interface GlossaryTouchOptions {
  /**
   * CSS selector for the elements that carry a definition in their
   * `title` attribute. Default: `"abbr[title]"`.
   */
  selector?: string;
  /**
   * Only activate on devices that can't hover (touch screens). Set to
   * `false` to also show the tap popover on desktop, where the native
   * `title` tooltip would show alongside it. Default: `true`.
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
 * Makes glossary tooltips usable on touch screens, where `<abbr title>`
 * never shows because there's no hover. Tapping a term shows its
 * definition in a small popover; tapping elsewhere, scrolling, or
 * pressing Escape dismisses it. Call once in the browser — in VitePress,
 * from your theme's `enhanceApp`.
 *
 * ```ts
 * // .vitepress/theme/index.ts
 * import DefaultTheme from "vitepress/theme";
 * import { enableGlossaryTouch } from "markdown-it-glossary/client";
 *
 * export default {
 *   extends: DefaultTheme,
 *   enhanceApp() {
 *     enableGlossaryTouch();
 *   },
 * };
 * ```
 *
 * Returns a function that removes the listeners and any open popover.
 * Safe to call during SSR — it does nothing without a `document`.
 */
export function enableGlossaryTouch(options: GlossaryTouchOptions = {}): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};

  const { selector = "abbr[title]", touchOnly = true, injectStyles = true } = options;

  if (touchOnly && !window.matchMedia("(hover: none)").matches) return () => {};

  if (injectStyles && !document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  let popover: HTMLElement | null = null;
  let anchor: Element | null = null;

  const close = (): void => {
    popover?.remove();
    popover = null;
    anchor = null;
  };

  const open = (target: Element, text: string): void => {
    close();
    anchor = target;

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

  const onClick = (event: Event): void => {
    const target = (event.target as Element | null)?.closest?.(selector) ?? null;
    if (!target) {
      close();
      return;
    }
    // Tapping the same term again toggles it off.
    if (target === anchor) {
      close();
      return;
    }
    const text = target.getAttribute("title");
    if (!text) return;
    // A term inside a link shouldn't navigate on the tap that reveals it.
    event.preventDefault();
    open(target, text);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", close, { passive: true });

  return () => {
    close();
    document.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", close);
  };
}
