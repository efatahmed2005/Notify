"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  let timer,
    current,
    generation = 0;

  async function refresh(token) {
    try {
      const document = await Notify.request(`/notices/${current.id}/document`);
      if (token !== generation || !$("documentDialog").open) return;
      $("documentStatus").textContent =
        document.status === "READY"
          ? `${document.pageCount} page${document.pageCount === 1 ? "" : "s"} rendered`
          : document.status === "FAILED"
            ? (document.error || "Document processing failed.")
            : "Preparing high-fidelity in-app preview...";
      $("retryDocument").hidden =
        document.status !== "FAILED" || !current.canManage;

      if (document.status === "READY") {
        $("documentPages").replaceChildren();
        for (let page = 1; page <= document.pageCount; page++) {
          const img = window.document.createElement("img");
          img.alt = `Document page ${page}`;
          img.loading = "lazy";
          img.src = `/api/notices/${current.id}/document/pages/${page}`;
          $("documentPages").append(img);
        }
      } else if (document.status !== "FAILED") {
        timer = setTimeout(() => refresh(token), 1500);
      }
    } catch (error) {
      if (token === generation) $("documentStatus").textContent = error.message;
    }
  }

  window.openDocument = (notice) => {
    clearTimeout(timer);
    current = notice;
    generation++;
    $("documentTitle").textContent = notice.file.name;
    $("documentPages").replaceChildren();
    $("retryDocument").hidden = true;
    $("documentDialog").showModal();
    refresh(generation);
  };

  $("retryDocument").onclick = async () => {
    $("retryDocument").disabled = true;
    try {
      await Notify.request(`/notices/${current.id}/document/retry`, {
        method: "POST",
        body: {},
      });
      await refresh(generation);
    } catch (error) {
      $("documentStatus").textContent = error.message;
    } finally {
      $("retryDocument").disabled = false;
    }
  };

  $("documentDialog").addEventListener("close", () => {
    clearTimeout(timer);
    generation++;
    $("documentPages").replaceChildren();
  });

  document.addEventListener("notify:signed-out", () => {
    $("documentDialog").close();
    current = null;
  });
})();
