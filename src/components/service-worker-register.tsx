"use client";

import { useEffect } from "react";

async function cacheOfflineShell(registration: ServiceWorkerRegistration) {
  try {
    const response = await fetch("/offline", { credentials: "same-origin" });
    if (!response.ok) return;
    const html = await response.text();
    const document = new DOMParser().parseFromString(html, "text/html");
    const urls = Array.from(
      document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
        "script[src], link[href]"
      )
    )
      .map((element) =>
        element instanceof HTMLScriptElement
          ? element.src
          : element.href
      )
      .filter((url) => new URL(url).pathname.startsWith("/_next/static/"));

    registration.active?.postMessage({
      type: "CACHE_URLS",
      urls: ["/offline", "/manifest.webmanifest", "/icon.svg", ...urls],
    });
  } catch {
    // A próxima inicialização online tenta preparar o shell novamente.
  }
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        await cacheOfflineShell(registration);
        void registration.update();
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  return null;
}

