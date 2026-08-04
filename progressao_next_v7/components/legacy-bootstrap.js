"use client";

import { useEffect } from "react";

function loadScript(src, type) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing || document.createElement("script");
    script.src = src;
    if (type) script.type = type;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
    if (!existing) document.body.appendChild(script);
  });
}

export function LegacyBootstrap() {
  useEffect(() => {
    if (window.__progressaoBootstrapped) return;
    window.__progressaoBootstrapped = true;

    (async () => {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8");
        await loadScript("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
        await loadScript("/static/app.js", "module");
      } catch (error) {
        window.__progressaoBootstrapped = false;
        const loading = document.getElementById("appLoading");
        if (loading) {
          const message = error instanceof Error ? error.message : "Erro desconhecido";
          loading.innerHTML = `<strong>Não foi possível iniciar o aplicativo.</strong><small>${message}</small>`;
        }
      }
    })();
  }, []);

  return null;
}
