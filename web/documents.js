"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  let timer,
    current,
    generation = 0;

  function switchTab(showOcr) {
    if ($("docTabPages")) $("docTabPages").classList.toggle("active", !showOcr);
    if ($("docTabOcr")) $("docTabOcr").classList.toggle("active", showOcr);
    if ($("documentPages")) $("documentPages").hidden = showOcr;
    if ($("documentOcr")) $("documentOcr").hidden = !showOcr;
  }

  if ($("docTabPages")) $("docTabPages").onclick = () => switchTab(false);
  if ($("docTabOcr")) $("docTabOcr").onclick = () => switchTab(true);

  async function refresh(token) {
    try {
      const document = await Notify.request(`/notices/${current.id}/document`);
      if (token !== generation || !$("documentDialog").open) return;
      $("documentStatus").textContent =
        document.status === "READY"
          ? `${document.pageCount} page${document.pageCount === 1 ? "" : "s"} rendered &bull; OCR processed`
          : document.status === "FAILED"
            ? (document.error || "Document processing failed.")
            : "Preparing high-fidelity in-app preview and recognizing text...";
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
        if ($("documentOcrText")) {
          $("documentOcrText").textContent =
            document.extracted_text || "No OCR text extracted from this document.";
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
    if ($("documentOcrText")) $("documentOcrText").textContent = "";
    switchTab(false);
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
