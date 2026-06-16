document.addEventListener("DOMContentLoaded", () => {
  const authStatusDot = document.getElementById("auth-status-dot");
  const authStatusText = document.getElementById("auth-status-text");
  const btnOpenSidepanel = document.getElementById("btn-open-sidepanel");
  const btnOpenOptions = document.getElementById("btn-open-options");

  chrome.storage.local.get(["onlysqApiKey"], (res) => {
    if (res.onlysqApiKey) {
      authStatusDot.className = "status-dot connected";
      authStatusText.textContent = "Подключен";
    } else {
      authStatusDot.className = "status-dot disconnected";
      authStatusText.textContent = "Не авторизован";
    }
  });

  btnOpenSidepanel.addEventListener("click", () => {
    chrome.windows.getCurrent((win) => {
      chrome.sidePanel.open({ windowId: win.id }).catch(() => {
        showToast("Нажмите на иконку расширения на панели инструментов для открытия панели.", "warning");
      });
    });
  });

  btnOpenOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  function showToast(msg, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-message">${msg}</div>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "toastFadeOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) both";
      setTimeout(() => {
        toast.remove();
      }, 200);
    }, 4000);
  }
});
