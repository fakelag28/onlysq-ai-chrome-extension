document.addEventListener("DOMContentLoaded", () => {
  const apiTokenInput = document.getElementById("api-token");
  const btnSaveToken = document.getElementById("btn-save-token");
  const authCard = document.getElementById("auth-card");
  const statusCard = document.getElementById("status-card");
  const activeApiKey = document.getElementById("active-api-key");
  const btnLogout = document.getElementById("btn-logout");
  const alertContainer = document.getElementById("alert-container");

  chrome.storage.local.get(["onlysqApiKey"], (res) => {
    if (res.onlysqApiKey) {
      apiTokenInput.value = res.onlysqApiKey;
      showStatus(res.onlysqApiKey);
    } else {
      showAuth();
    }
  });

  btnSaveToken.addEventListener("click", () => {
    const token = apiTokenInput.value.trim();
    if (!textIsValidToken(token)) {
      showAlert("Пожалуйста, введите корректный токен OnlySQ (sq-...)", "error");
      return;
    }

    showAlert("Проверка токена...", "info");
    fetch("https://api.onlysq.ru/ai/models", {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(r => {
      if (r.ok) {
        chrome.storage.local.set({
          onlysqApiKey: token,
          authMethod: "token"
        }, () => {
          showAlert("Токен API успешно сохранен и проверен!", "success");
          showStatus(token);
        });
      } else {
        showAlert("Неверный токен API (сервер вернул ошибку)", "error");
      }
    })
    .catch(err => {
      showAlert("Ошибка сети: " + err.message, "error");
    });
  });

  btnLogout.addEventListener("click", () => {
    chrome.storage.local.remove(["onlysqApiKey", "authMethod"], () => {
      showAlert("Вы успешно вышли из системы", "success");
      apiTokenInput.value = "";
      showAuth();
    });
  });

  function textIsValidToken(token) {
    return token && (token.startsWith("sq-") || token.startsWith("sk-")) && token.length > 5;
  }

  function showStatus(token) {
    authCard.style.display = "none";
    statusCard.style.display = "block";
    const masked = token.substring(0, 8) + "••••" + token.substring(token.length - 4);
    activeApiKey.textContent = masked;
  }

  function showAuth() {
    authCard.style.display = "block";
    statusCard.style.display = "none";
  }

  function showAlert(msg, type) {
    alertContainer.innerHTML = `
      <div class="alert-bar ${type}">
        <span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : type === 'info' ? 'info' : 'warning'}</span>
        <div class="alert-bar-content">
          <div class="alert-bar-title">${type}</div>
          <div class="alert-bar-message">${msg}</div>
        </div>
      </div>
    `;
    setTimeout(() => {
      alertContainer.innerHTML = "";
    }, 6000);
  }
});
