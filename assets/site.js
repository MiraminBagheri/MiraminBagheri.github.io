/* Local enhancements only: no requests, persistence, analytics or dependencies.
 * Navigation: .menu-toggle, #navigation, #scroll-progress.
 * Motion: #motion-toggle[data-pause-label][data-play-label], .reveal.
 * System map: [data-layer][role=tab], [data-system-panel], .system-map.
 * Contact: [data-copy-email][data-email], #copy-status[aria-live].
 */
(() => {
  "use strict";

  function init() {
    const root = document.documentElement;
    const body = document.body;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let manuallyPaused = false;
    let motionAllowed = false;
    const motionButton = document.getElementById("motion-toggle");
    const reveals = [...document.querySelectorAll(".reveal")];
    const maps = [...document.querySelectorAll(".system-map")];
    const pointerResets = [];
    let revealObserver = null;

    function onMediaChange(query, callback) {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", callback);
      } else if (typeof query.addListener === "function") {
        query.addListener(callback);
      }
    }

    function showAllReveals() {
      reveals.forEach((element) => element.classList.add("is-visible"));
      if (revealObserver) revealObserver.disconnect();
    }

    // Register the observer before enabling CSS that can hide reveal elements.
    // Without observer support, every section remains visible.
    if ("IntersectionObserver" in window) {
      try {
        revealObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
        reveals.forEach((element) => revealObserver.observe(element));
      } catch {
        showAllReveals();
      }
    } else {
      showAllReveals();
    }

    function applyMotionPreference() {
      motionAllowed = !reducedMotion.matches && !manuallyPaused;
      root.classList.toggle("motion-enabled", motionAllowed);
      body.classList.toggle("motion-paused", !motionAllowed);

      if (motionButton) {
        // Pressed means paused. The OS preference takes precedence over play.
        motionButton.setAttribute("aria-pressed", String(!motionAllowed));
        motionButton.disabled = reducedMotion.matches;
        const label = reducedMotion.matches && motionButton.dataset.reducedLabel
          ? motionButton.dataset.reducedLabel
          : motionAllowed
            ? motionButton.dataset.pauseLabel
            : motionButton.dataset.playLabel;
        if (label) {
          const labelElement = motionButton.querySelector("[data-motion-label]");
          if (labelElement) labelElement.textContent = label;
          else motionButton.textContent = label;
          motionButton.setAttribute("aria-label", label);
        }
      }

      if (!motionAllowed) {
        showAllReveals();
        pointerResets.forEach((reset) => reset());
      }
    }

    if (motionButton) {
      motionButton.addEventListener("click", () => {
        if (reducedMotion.matches) return;
        manuallyPaused = !manuallyPaused;
        applyMotionPreference();
      });
    }
    onMediaChange(reducedMotion, applyMotionPreference);
    applyMotionPreference();

    const menuButton = document.querySelector(".menu-toggle");
    const navigation = document.getElementById("navigation");
    if (menuButton && navigation) {
      function setMenuOpen(open, restoreFocus = false) {
        menuButton.setAttribute("aria-expanded", String(open));
        navigation.classList.toggle("is-open", open);
        body.classList.toggle("menu-open", open);
        if (restoreFocus) menuButton.focus();
      }

      menuButton.setAttribute("aria-controls", navigation.id);
      setMenuOpen(false);
      menuButton.addEventListener("click", () => {
        setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
      });
      navigation.addEventListener("click", (event) => {
        if (event.target.closest("a")) setMenuOpen(false);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
          event.preventDefault();
          setMenuOpen(false, true);
        }
      });
      document.addEventListener("click", (event) => {
        if (!navigation.contains(event.target) && !menuButton.contains(event.target)) {
          setMenuOpen(false);
        }
      });
    }

    const progress = document.getElementById("scroll-progress");
    const sectionLinks = navigation
      ? [...navigation.querySelectorAll('a[href^="#"]')].map((link) => {
        let id;
        try { id = decodeURIComponent(link.getAttribute("href").slice(1)); }
        catch { return null; }
        const section = id ? document.getElementById(id) : null;
        return section ? { link, section } : null;
      }).filter(Boolean)
      : [];
    let scrollFrame = 0;

    function updateScrollState() {
      scrollFrame = 0;
      const scrollTop = Math.max(0, window.scrollY || root.scrollTop || 0);
      const distance = Math.max(root.scrollHeight, body.scrollHeight) - window.innerHeight;
      const fraction = distance > 0 ? Math.min(1, scrollTop / distance) : 0;
      if (progress) progress.style.transform = `scaleX(${fraction})`;

      if (sectionLinks.length) {
        const threshold = Math.min(180, Math.max(96, window.innerHeight * 0.2));
        let active = sectionLinks[0];
        sectionLinks.forEach((entry) => {
          if (entry.section.getBoundingClientRect().top <= threshold) active = entry;
        });
        if (distance > 0 && distance - scrollTop <= 2) {
          active = sectionLinks[sectionLinks.length - 1];
        }
        sectionLinks.forEach((entry) => {
          const selected = entry === active;
          entry.link.classList.toggle("is-active", selected);
          if (selected) entry.link.setAttribute("aria-current", "location");
          else entry.link.removeAttribute("aria-current");
        });
      }
    }

    function scheduleScrollUpdate() {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollState);
    }
    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollUpdate, { passive: true });
    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(scheduleScrollUpdate);
      resizeObserver.observe(body);
    }
    scheduleScrollUpdate();

    const panels = [...document.querySelectorAll("[data-system-panel]")];
    const tabs = [...document.querySelectorAll('[data-layer][role="tab"]')]
      .filter((tab) => panels.some((panel) =>
        panel.id === (tab.getAttribute("aria-controls") || `panel-${tab.dataset.layer}`)));

    function selectTab(tab, focus = false) {
      const layer = tab.dataset.layer;
      const panelId = tab.getAttribute("aria-controls") || `panel-${layer}`;
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => {
        panel.hidden = panel.id !== panelId;
        if (panel.id === panelId && tab.id) panel.setAttribute("aria-labelledby", tab.id);
      });
      maps.forEach((map) => { map.dataset.active = layer; });
      if (focus) tab.focus();
      scheduleScrollUpdate();
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectTab(tab));
      tab.addEventListener("keydown", (event) => {
        const tabList = tab.closest('[role="tablist"]');
        const vertical = tabList?.getAttribute("aria-orientation") === "vertical";
        const rtl = window.getComputedStyle(tabList || tab).direction === "rtl";
        let nextIndex = index;
        if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else if (!vertical && event.key === "ArrowRight") nextIndex += rtl ? -1 : 1;
        else if (!vertical && event.key === "ArrowLeft") nextIndex += rtl ? 1 : -1;
        else if (vertical && event.key === "ArrowDown") nextIndex += 1;
        else if (vertical && event.key === "ArrowUp") nextIndex -= 1;
        else return;
        event.preventDefault();
        selectTab(tabs[(nextIndex + tabs.length) % tabs.length], true);
      });
    });
    if (tabs.length) selectTab(tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0]);

    function copyWithSelection(value) {
      const activeElement = document.activeElement;
      const selection = window.getSelection();
      const ranges = selection
        ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
        : [];
      const field = document.createElement("textarea");
      field.value = value;
      field.readOnly = true;
      field.tabIndex = -1;
      field.setAttribute("aria-hidden", "true");
      field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
      body.appendChild(field);
      let copied = false;
      try {
        field.focus({ preventScroll: true });
        field.select();
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      } finally {
        field.remove();
        if (activeElement instanceof HTMLElement) activeElement.focus({ preventScroll: true });
        if (selection) {
          selection.removeAllRanges();
          ranges.forEach((range) => selection.addRange(range));
        }
      }
      return copied;
    }

    const copyStatus = document.getElementById("copy-status");
    document.querySelectorAll("[data-copy-email]").forEach((button) => {
      let feedbackTimer = 0;
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const email = button.dataset.email || "";
        if (copyStatus) copyStatus.textContent = "";
        const originallyDisabled = button.disabled;
        button.disabled = true;
        let copied = false;
        try {
          if (email && navigator.clipboard?.writeText && window.isSecureContext) {
            try {
              await navigator.clipboard.writeText(email);
              copied = true;
            } catch {
              copied = copyWithSelection(email);
            }
          } else if (email) {
            copied = copyWithSelection(email);
          }
        } finally {
          button.disabled = originallyDisabled;
        }
        const message = copied
          ? button.dataset.copied || "Email address copied."
          : button.dataset.failed || "Copy unavailable. Please select the email address.";
        button.dataset.copyState = copied ? "copied" : "failed";
        if (copyStatus) window.requestAnimationFrame(() => { copyStatus.textContent = message; });
        window.clearTimeout(feedbackTimer);
        feedbackTimer = window.setTimeout(() => { delete button.dataset.copyState; }, 3000);
      });
    });

    maps.forEach((map) => {
      let pointerFrame = 0;
      let pointerX = 0;
      let pointerY = 0;

      function resetPointer() {
        if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
        pointerX = 0;
        pointerY = 0;
        map.style.setProperty("--pointer-x", "0px");
        map.style.setProperty("--pointer-y", "0px");
      }
      pointerResets.push(resetPointer);
      resetPointer();

      map.addEventListener("pointermove", (event) => {
        if (!motionAllowed || !finePointer.matches || event.pointerType === "touch") return;
        const bounds = map.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        pointerX = Math.max(-6, Math.min(6, ((event.clientX - bounds.left) / bounds.width - 0.5) * 12));
        pointerY = Math.max(-6, Math.min(6, ((event.clientY - bounds.top) / bounds.height - 0.5) * 12));
        if (!pointerFrame) {
          pointerFrame = window.requestAnimationFrame(() => {
            pointerFrame = 0;
            if (!motionAllowed || !finePointer.matches) return resetPointer();
            map.style.setProperty("--pointer-x", `${pointerX.toFixed(2)}px`);
            map.style.setProperty("--pointer-y", `${pointerY.toFixed(2)}px`);
          });
        }
      }, { passive: true });
      map.addEventListener("pointerleave", resetPointer, { passive: true });
      map.addEventListener("pointercancel", resetPointer, { passive: true });
    });
    onMediaChange(finePointer, () => pointerResets.forEach((reset) => reset()));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
