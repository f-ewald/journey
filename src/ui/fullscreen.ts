import "@f-ewald/components/icon-button.js";
import { iconArrowsPointingIn, iconArrowsPointingOut } from "@f-ewald/components/icons.js";

/**
 * Vendor-prefixed Fullscreen API members still needed by Safari, which has no
 * unprefixed support on the document.
 */
interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const ICON_SIZE = 20;

/** Whether any element is currently presented fullscreen. */
export function isFullscreen(): boolean {
  const doc = document as WebkitDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/**
 * Mounts the fullscreen toggle and keeps its icon and label in sync with the
 * actual fullscreen state — which can change without the button, via Escape or
 * the browser's own controls.
 *
 * `onChange` runs after every state change so the caller can re-align layout
 * that depends on viewport height.
 */
export function renderFullscreenButton(host: HTMLElement, onChange: () => void): void {
  const button = document.createElement("icon-button");
  button.className = "fullscreen-toggle";
  button.addEventListener("click", () => {
    void toggleFullscreen();
  });
  host.replaceChildren(button);

  const sync = () => {
    const active = isFullscreen();
    button.icon = active ? iconArrowsPointingIn(ICON_SIZE) : iconArrowsPointingOut(ICON_SIZE);
    button.label = active ? "Exit full screen" : "Enter full screen";
  };

  sync();
  document.addEventListener("fullscreenchange", () => {
    sync();
    onChange();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    sync();
    onChange();
  });
}

/**
 * Toggles fullscreen on the whole document. Rejections are swallowed: browsers
 * refuse the request outside a user gesture or under permissions policy, and
 * there is nothing useful to tell the presenter mid-talk.
 */
async function toggleFullscreen(): Promise<void> {
  const doc = document as WebkitDocument;
  try {
    if (isFullscreen()) {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    const root = document.documentElement as WebkitElement;
    await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
  } catch {
    // Ignored — see doc comment.
  }
}
