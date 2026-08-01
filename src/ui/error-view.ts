import "@f-ewald/components/status-banner.js";

/**
 * Replaces the page with a single visible failure message. Used for YAML
 * validation problems and for a missing Mapbox token alike, so no failure mode
 * can leave a blank screen behind.
 */
export function renderError(host: HTMLElement, title: string, details: string[]): void {
  host.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.className = "error-view";

  const banner = document.createElement("status-banner");
  banner.setAttribute("variant", "danger");
  banner.textContent = title;
  wrapper.append(banner);

  if (details.length > 0) {
    const list = document.createElement("ul");
    list.className = "error-view__details";
    for (const detail of details) {
      const item = document.createElement("li");
      item.textContent = detail;
      list.append(item);
    }
    wrapper.append(list);
  }

  host.append(wrapper);
}
