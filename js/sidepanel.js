document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const btnCollapse = document.getElementById("btn-collapse");
  const btnNewChat = document.getElementById("btn-new-chat");
  const btnOptions = document.getElementById("btn-options");
  const chatsListContainer = document.getElementById("chats-list-container");
  const activeChatTitle = document.getElementById("active-chat-title");
  const modelSelectContainer = document.getElementById("model-select-container");
  const modelSelectTrigger = document.getElementById("model-select-trigger");
  const modelSelectValue = document.getElementById("model-select-value");
  const modelSelectDropdown = document.getElementById("model-select-dropdown");
  const reasoningSelectContainer = document.getElementById("reasoning-select-container");
  const reasoningSelectTrigger = document.getElementById("reasoning-select-trigger");
  const reasoningSelectValue = document.getElementById("reasoning-select-value");
  const reasoningSelectDropdown = document.getElementById("reasoning-select-dropdown");
  const messagesContainer = document.getElementById("messages-container");

  const chips = document.querySelectorAll(".context-chip");
  const previewContainer = document.getElementById("preview-container");
  const screenshotPreviewImg = document.getElementById("screenshot-preview-img");
  const btnClearScreenshot = document.getElementById("btn-clear-screenshot");
  const chatInputTextarea = document.getElementById("chat-input-textarea");
  const btnSendMessage = document.getElementById("btn-send-message");

  let chats = [];
  let activeChatId = null;
  let activeContext = "none";
  let currentScreenshotDataUrl = null;
  let isAgentMode = false;
  let currentSelectedModel = "gemini-3.5-flash";
  let currentReasoningLevel = "medium";
  let agentStepCount = 0;
  let agentTabId = null;

  modelSelectTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    modelSelectContainer.classList.toggle("open");
    reasoningSelectContainer.classList.remove("open");
  });

  reasoningSelectTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    reasoningSelectContainer.classList.toggle("open");
    modelSelectContainer.classList.remove("open");
  });

  document.addEventListener("click", () => {
    modelSelectContainer.classList.remove("open");
    reasoningSelectContainer.classList.remove("open");
  });

  messagesContainer.addEventListener("click", (e) => {
    const header = e.target.closest(".think-header");
    if (header) {
      const block = header.closest(".think-block");
      if (block) {
        block.classList.toggle("collapsed");
        const toggleIcon = block.querySelector(".think-toggle");
        if (toggleIcon) {
          toggleIcon.textContent = block.classList.contains("collapsed") ? "expand_more" : "expand_less";
        }
      }
    }
  });

  btnCollapse.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    btnCollapse.textContent = sidebar.classList.contains("collapsed") ? "menu" : "close";
  });

  btnOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const context = chip.getAttribute("data-context");
      if (context === "agent") {
        isAgentMode = !isAgentMode;
        chip.classList.toggle("active", isAgentMode);
        if (isAgentMode && activeContext === "none") {
          document.getElementById("chip-none").classList.remove("active");
          const pageChip = document.getElementById("chip-page");
          pageChip.classList.add("active");
          activeContext = "page";
        }
        return;
      }

      chips.forEach(c => {
        if (c.getAttribute("data-context") !== "agent") {
          c.classList.remove("active");
        }
      });

      activeContext = context;
      chip.classList.add("active");

      if (context === "vision") {
        captureActiveTab();
      } else {
        clearScreenshot();
      }
    });
  });

  btnClearScreenshot.addEventListener("click", (e) => {
    e.stopPropagation();
    clearScreenshot();
    document.getElementById("chip-vision").classList.remove("active");
    document.getElementById("chip-none").classList.add("active");
    activeContext = "none";
  });

  btnNewChat.addEventListener("click", () => {
    createNewChat();
  });

  btnSendMessage.addEventListener("click", () => {
    sendMessage();
  });

  chatInputTextarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      sendMessage();
    }
  });

  chatInputTextarea.addEventListener("input", () => {
    chatInputTextarea.style.height = "auto";
    chatInputTextarea.style.height = Math.min(chatInputTextarea.scrollHeight, 120) + "px";
  });

  function setupOptionListeners() {
    const modelOptions = modelSelectDropdown.querySelectorAll(".custom-select-option");
    modelOptions.forEach(opt => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const val = opt.getAttribute("data-value");
        selectModel(val);
        modelSelectContainer.classList.remove("open");
      });
    });

    const reasoningOptions = reasoningSelectDropdown.querySelectorAll(".custom-select-option");
    reasoningOptions.forEach(opt => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const val = opt.getAttribute("data-value");
        selectReasoning(val);
        reasoningSelectContainer.classList.remove("open");
      });
    });
  }

  function selectModel(val) {
    currentSelectedModel = val;
    modelSelectValue.textContent = val;
    chrome.storage.local.set({ selectedModel: val });
    const options = modelSelectDropdown.querySelectorAll(".custom-select-option");
    options.forEach(opt => {
      if (opt.getAttribute("data-value") === val) {
        opt.classList.add("selected");
        modelSelectValue.textContent = opt.textContent;
      } else {
        opt.classList.remove("selected");
      }
    });
  }

  function selectReasoning(val) {
    currentReasoningLevel = val;
    reasoningSelectValue.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    chrome.storage.local.set({ selectedReasoningLevel: val });
    const options = reasoningSelectDropdown.querySelectorAll(".custom-select-option");
    options.forEach(opt => {
      if (opt.getAttribute("data-value") === val) {
        opt.classList.add("selected");
        reasoningSelectValue.textContent = opt.textContent;
      } else {
        opt.classList.remove("selected");
      }
    });
  }

  initData();

  function initData() {
    chrome.storage.local.get(["chats", "activeChatId", "selectedModel", "selectedReasoningLevel"], (res) => {
      if (res.chats && res.chats.length > 0) {
        chats = res.chats;
        activeChatId = res.activeChatId || chats[0].id;
      } else {
        chats = [];
        activeChatId = null;
      }

      if (res.selectedModel) {
        currentSelectedModel = res.selectedModel;
        selectModel(currentSelectedModel);
      } else {
        selectModel("gemini-3.5-flash");
      }

      if (res.selectedReasoningLevel) {
        currentReasoningLevel = res.selectedReasoningLevel;
        selectReasoning(currentReasoningLevel);
      } else {
        selectReasoning("medium");
      }

      setupOptionListeners();
      fetchModels();
      
      if (chats.length === 0) {
        createNewChat();
      } else {
        renderChatsList();
        renderActiveChatMessages();
      }
    });
  }

  function fetchModels() {
    fetch("https://api.onlysq.ru/ai/models")
      .then(r => r.json())
      .then(data => {
        if (data && data.models) {
          const prevValue = currentSelectedModel;
          modelSelectDropdown.innerHTML = "";
          let modelsList = [];
          Object.entries(data.models).forEach(([id, m]) => {
            if (m.modality === "text") {
              modelsList.push({ id, name: m.name });
            }
          });
          if (modelsList.length > 0) {
            modelsList.forEach(m => {
              const opt = document.createElement("div");
              opt.className = "custom-select-option";
              opt.setAttribute("data-value", m.id);
              opt.textContent = m.name;
              modelSelectDropdown.appendChild(opt);
            });
            setupOptionListeners();
            const modelExists = modelsList.some(m => m.id === prevValue);
            if (modelExists) {
              selectModel(prevValue);
            } else {
              selectModel(modelsList[0].id);
            }
          }
        }
      })
      .catch(() => {});
  }

  function createNewChat() {
    const id = Date.now().toString();
    const newChat = {
      id: id,
      title: "Без названия",
      messages: []
    };
    chats.unshift(newChat);
    activeChatId = id;
    agentTabId = null;
    saveChats();
    renderChatsList();
    renderActiveChatMessages();
    if (window.innerWidth <= 500) {
      sidebar.classList.add("collapsed");
      btnCollapse.textContent = "menu";
    }
  }

  function saveChats() {
    chrome.storage.local.set({ chats: chats, activeChatId: activeChatId });
  }

  function renderChatsList() {
    chatsListContainer.innerHTML = "";
    chats.forEach(c => {
      const item = document.createElement("div");
      item.className = `chat-item ${c.id === activeChatId ? "active" : ""}`;
      item.addEventListener("click", () => {
        activeChatId = c.id;
        agentTabId = null;
        saveChats();
        renderChatsList();
        renderActiveChatMessages();
        if (window.innerWidth <= 500) {
          sidebar.classList.add("collapsed");
          btnCollapse.textContent = "menu";
        }
      });

      const titleSpan = document.createElement("span");
      titleSpan.className = "chat-item-title";
      titleSpan.textContent = c.title;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-delete-chat material-symbols-outlined";
      deleteBtn.textContent = "delete";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteChat(c.id);
      });

      item.appendChild(titleSpan);
      item.appendChild(deleteBtn);
      chatsListContainer.appendChild(item);
    });
  }

  function deleteChat(id) {
    chats = chats.filter(c => c.id !== id);
    if (activeChatId === id) {
      activeChatId = chats.length > 0 ? chats[0].id : null;
    }
    agentTabId = null;
    if (chats.length === 0) {
      createNewChat();
    } else {
      saveChats();
      renderChatsList();
      renderActiveChatMessages();
    }
  }

  function regenerateMessage(index) {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;
    activeChat.messages = activeChat.messages.slice(0, index);
    saveChats();
    renderChatsList();
    renderActiveChatMessages();
    sendMessage(true);
  }

  function renderActiveChatMessages() {
    messagesContainer.innerHTML = "";
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;

    activeChatTitle.textContent = activeChat.title;

    if (activeChat.messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="msg system">
          <div class="msg-content">Чат создан. Выберите контекст и задайте свой вопрос.</div>
        </div>
      `;
      return;
    }

    activeChat.messages.forEach((m, index) => {
      if (m.isHiddenSystem) return;
      displayMessage(m.role, m.content, index);
    });
    scrollToBottom();
  }

  function displayMessage(role, content, index) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `msg ${role}`;

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "msg-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-action-btn material-symbols-outlined";
    copyBtn.textContent = "content_copy";
    copyBtn.title = "Копировать";
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      let textToCopy = content;
      if (typeof index === "number" && index >= 0) {
        const activeChat = chats.find(c => c.id === activeChatId);
        if (activeChat && activeChat.messages[index]) {
          textToCopy = activeChat.messages[index].content;
        }
      }
      textToCopy = textToCopy.replace(/\[ACTION:\s*OPEN_TAB,\s*url:\s*"([^"]+)"\]/g, "");
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast("Сообщение скопировано в буфер обмена", "success");
      }).catch(() => {
        showToast("Не удалось скопировать сообщение", "error");
      });
    });
    actionsDiv.appendChild(copyBtn);

    if (role === "assistant" && typeof index === "number" && index >= 0) {
      const regenBtn = document.createElement("button");
      regenBtn.className = "msg-action-btn material-symbols-outlined";
      regenBtn.textContent = "refresh";
      regenBtn.title = "Перегенерировать";
      regenBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        regenerateMessage(index);
      });
      actionsDiv.appendChild(regenBtn);
    }
    msgDiv.appendChild(actionsDiv);

    const header = document.createElement("div");
    header.className = "msg-header";
    header.textContent = role === "user" ? "Вы" : role === "assistant" ? "ИИ" : "Система";

    const contentDiv = document.createElement("div");
    contentDiv.className = "msg-content";

    let rawText = content.replace(/\[ACTION:\s*OPEN_TAB,\s*url:\s*"([^"]+)"\]/g, "");
    let thinkText = "";

    const thinkStart = content.indexOf("<think>");
    const thinkEnd = content.indexOf("</think>");

    if (thinkStart !== -1 && thinkEnd !== -1 && thinkEnd > thinkStart) {
      thinkText = content.substring(thinkStart + 7, thinkEnd).trim();
      rawText = content.substring(thinkEnd + 8).replace(/\[ACTION:\s*OPEN_TAB,\s*url:\s*"([^"]+)"\]/g, "").trim();
    } else if (thinkStart !== -1) {
      thinkText = content.substring(thinkStart + 7).trim();
      rawText = "";
    }

    if (thinkText) {
      const thinkBlock = document.createElement("div");
      thinkBlock.className = "think-block";
      
      const thinkHeader = document.createElement("div");
      thinkHeader.className = "think-header";
      thinkHeader.style.cursor = "pointer";
      thinkHeader.style.userSelect = "none";
      thinkHeader.style.display = "flex";
      thinkHeader.style.justifyContent = "space-between";
      thinkHeader.style.alignItems = "center";
      thinkHeader.style.width = "100%";
      thinkHeader.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px;">
          <span class="material-symbols-outlined" style="font-size: 12px !important;">terminal</span>Мысли агента (рассуждение)
        </div>
        <span class="think-toggle material-symbols-outlined" style="font-size: 14px !important;">expand_less</span>
      `;
      
      const thinkContent = document.createElement("div");
      thinkContent.className = "think-content";
      thinkContent.textContent = thinkText;
      
      thinkBlock.appendChild(thinkHeader);
      thinkBlock.appendChild(thinkContent);
      contentDiv.appendChild(thinkBlock);
    }

    if (rawText) {
      const textSpan = document.createElement("span");
      textSpan.innerHTML = formatMarkdown(rawText);
      contentDiv.appendChild(textSpan);
    }

    if (role === "user" && typeof index === "number" && index >= 0) {
      const activeChat = chats.find(c => c.id === activeChatId);
      if (activeChat && activeChat.messages[index] && activeChat.messages[index].screenshot) {
        const img = document.createElement("img");
        img.src = activeChat.messages[index].screenshot;
        img.className = "message-screenshot";
        contentDiv.appendChild(img);
      }
    }

    msgDiv.appendChild(header);
    msgDiv.appendChild(contentDiv);
    messagesContainer.appendChild(msgDiv);
    return msgDiv;
  }

  function formatMarkdown(text) {
    const lines = text.split("\n");
    let inList = false;
    let inOrderedList = false;
    let inCodeBlock = false;
    let codeContent = [];
    let formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const escapedCode = codeContent.join("\n")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          formattedLines.push(`<pre class="mono" style="background-color: var(--color-surface-2); border: 1px solid var(--color-border); padding: 12px; margin: 10px 0; overflow-x: auto;">${escapedCode}</pre>`);
          codeContent = [];
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      let safeLine = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      safeLine = safeLine.replace(/`([^`]+)`/g, '<code class="mono" style="background-color: var(--color-surface-2); padding: 2px 4px; border: 1px solid var(--color-border); color: var(--color-accent-soft);">$1</code>');
      safeLine = safeLine.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      safeLine = safeLine.replace(/\*([^*]+)\*/g, '<em>$1</em>');

      if (safeLine.startsWith("###### ")) {
        safeLine = `<h6>${safeLine.substring(7)}</h6>`;
      } else if (safeLine.startsWith("##### ")) {
        safeLine = `<h5>${safeLine.substring(6)}</h5>`;
      } else if (safeLine.startsWith("#### ")) {
        safeLine = `<h4>${safeLine.substring(5)}</h4>`;
      } else if (safeLine.startsWith("### ")) {
        safeLine = `<h3>${safeLine.substring(4)}</h3>`;
      } else if (safeLine.startsWith("## ")) {
        safeLine = `<h2>${safeLine.substring(3)}</h2>`;
      } else if (safeLine.startsWith("# ")) {
        safeLine = `<h1>${safeLine.substring(2)}</h1>`;
      }

      const unorderedMatch = safeLine.match(/^(\s*)(?:-|\*|\+)\s+(.+)$/);
      if (unorderedMatch) {
        if (inOrderedList) {
          formattedLines.push("</ol>");
          inOrderedList = false;
        }
        if (!inList) {
          formattedLines.push('<ul style="margin-left: 20px; margin-bottom: 8px;">');
          inList = true;
        }
        formattedLines.push(`<li>${unorderedMatch[2]}</li>`);
        continue;
      }

      const orderedMatch = safeLine.match(/^(\s*)\d+\.\s+(.+)$/);
      if (orderedMatch) {
        if (inList) {
          formattedLines.push("</ul>");
          inList = false;
        }
        if (!inOrderedList) {
          formattedLines.push('<ol style="margin-left: 20px; margin-bottom: 8px;">');
          inOrderedList = true;
        }
        formattedLines.push(`<li>${orderedMatch[2]}</li>`);
        continue;
      }

      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      if (inOrderedList) {
        formattedLines.push("</ol>");
        inOrderedList = false;
      }

      formattedLines.push(safeLine);
    }

    if (inCodeBlock && codeContent.length > 0) {
      const escapedCode = codeContent.join("\n")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      formattedLines.push(`<pre class="mono" style="background-color: var(--color-surface-2); border: 1px solid var(--color-border); padding: 12px; margin: 10px 0; overflow-x: auto;">${escapedCode}</pre>`);
    }
    if (inList) {
      formattedLines.push("</ul>");
    }
    if (inOrderedList) {
      formattedLines.push("</ol>");
    }

    let finalHtml = "";
    for (let i = 0; i < formattedLines.length; i++) {
      const cur = formattedLines[i];
      const next = formattedLines[i + 1];
      finalHtml += cur;
      
      if (cur && !cur.startsWith("<ul") && !cur.startsWith("</ul") && !cur.startsWith("<ol") && !cur.startsWith("</ol") && !cur.startsWith("<li") && !cur.startsWith("<pre") && !cur.startsWith("<h") && !cur.endsWith(">") && next !== undefined) {
        finalHtml += "<br>";
      }
    }
    return finalHtml;
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function clearScreenshot() {
    currentScreenshotDataUrl = null;
    previewContainer.style.display = "none";
    screenshotPreviewImg.style.backgroundImage = "none";
  }

  function captureActiveTab() {
    clearScreenshot();
    chrome.runtime.sendMessage({ action: "captureTabScreenshot" }, (response) => {
      if (chrome.runtime.lastError) {
        showToast("Не удалось сделать снимок экрана. Ошибка расширения.", "error");
        document.getElementById("chip-vision").classList.remove("active");
        document.getElementById("chip-none").classList.add("active");
        activeContext = "none";
        return;
      }
      if (response && response.success && response.dataUrl) {
        currentScreenshotDataUrl = response.dataUrl;
        screenshotPreviewImg.style.backgroundImage = `url(${response.dataUrl})`;
        previewContainer.style.display = "flex";
      } else {
        showToast("Не удалось сделать снимок экрана. Убедитесь, что вкладка полностью загружена.", "error");
        document.getElementById("chip-vision").classList.remove("active");
        document.getElementById("chip-none").classList.add("active");
        activeContext = "none";
      }
    });
  }

  async function getTabContext() {
    return new Promise((resolve) => {
      if (activeContext === "none") {
        resolve(null);
      } else if (activeContext === "page") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length === 0) return resolve(null);
          chrome.tabs.sendMessage(tabs[0].id, { action: "getPageContent" }, (res) => {
            if (chrome.runtime.lastError) {
              showToast("Нет доступа к содержимому вкладки (убедитесь, что страница загружена и не является системной).", "warning");
              resolve(null);
              return;
            }
            if (res && res.success) {
              resolve(`[Текущая вкладка: ${res.title} (${res.url})]\n\nСодержимое:\n${res.content}`);
            } else {
              resolve(null);
            }
          });
        });
      } else if (activeContext === "all-tabs") {
        chrome.tabs.query({ currentWindow: true }, async (tabs) => {
          const executeScriptWithTimeout = (tabId, details, timeoutMs = 1500) => {
            return new Promise((resolve) => {
              let completed = false;
              const timeoutId = setTimeout(() => {
                if (!completed) {
                  completed = true;
                  resolve(null);
                }
              }, timeoutMs);
              chrome.scripting.executeScript(details, (results) => {
                if (!completed) {
                  completed = true;
                  clearTimeout(timeoutId);
                  if (chrome.runtime.lastError) {
                    resolve(null);
                  } else {
                    resolve(results);
                  }
                }
              });
            });
          };

          const promises = tabs.map(tab => {
            if (tab.url && tab.url.startsWith("http")) {
              return executeScriptWithTimeout(tab.id, {
                target: { tabId: tab.id },
                func: () => document.body.innerText
              }, 1500).then(results => {
                if (results && results[0]) {
                  const text = results[0].result.replace(/\s+/g, " ").trim().substring(0, 10000);
                  return `[Вкладка: ${tab.title} (${tab.url})]\n${text}`;
                } else {
                  return `[Вкладка: ${tab.title} (${tab.url})] (Нет доступа к содержимому)`;
                }
              });
            } else {
              return Promise.resolve(null);
            }
          });
          
          const results = await Promise.all(promises);
          const contextParts = results.filter(r => r !== null);
          resolve(contextParts.join("\n\n---\n\n").substring(0, 80000));
        });
      } else {
        resolve(null);
      }
    });
  }

  async function sendMessage(isRegenerate = false) {
    if (!isRegenerate) {
      agentStepCount = 0;
    }
    const text = isRegenerate ? "" : chatInputTextarea.value.trim();
    if (!isRegenerate && !text && !currentScreenshotDataUrl) return;

    chrome.storage.local.get(["onlysqApiKey"], async (res) => {
      const apiKey = res.onlysqApiKey;
      if (!apiKey) {
        showToast("Настройте API ключ OnlySQ в параметрах расширения.", "warning");
        chrome.runtime.openOptionsPage();
        return;
      }

      if (!isRegenerate) {
        chatInputTextarea.value = "";
        chatInputTextarea.style.height = "32px";
      }

      const selectedModel = currentSelectedModel;
      const activeChat = chats.find(c => c.id === activeChatId);
      if (!activeChat) return;

      if (!isRegenerate && activeChat.messages.length === 0 && text) {
        activeChat.title = text.substring(0, 24) + (text.length > 24 ? "..." : "");
      }

      let systemPrompt = "";
      if (isAgentMode) {
        systemPrompt = "Вы работаете в АГЕНТНОМ РЕЖИМЕ. Выполняйте задачи пользователя по шагам, анализируя предоставленный контекст вкладок. Вы можете совершать действия на веб-страницах. Для выполнения действия добавьте в самом конце вашего ответа ровно ОДНУ команду в одном из форматов:\n1. Открытие новой страницы: [ACTION: OPEN_TAB, url: \"ПОЛНЫЙ_URL\"]\n2. Клик по ссылке/кнопке по тексту: [ACTION: CLICK, text: \"ТЕКСТ_ССЫЛКИ_ИЛИ_КНОПКИ\"]\n3. Прокрутка страницы: [ACTION: SCROLL, direction: \"down\" | \"up\"]\n4. Ожидание: [ACTION: WAIT, seconds: ЧИСЛО_СЕКУНД]\n5. Закрытие вкладки агента: [ACTION: CLOSE_TAB]\n\nПосле выполнения каждого действия (кроме CLOSE_TAB) вы получите обновленное содержимое страницы в качестве системного сообщения и сможете предпринять следующее действие. Всегда пишите мысли внутри <think> ... </think>, а итоговое сообщение или команду — после закрывающего тега. Пишите команду только при необходимости продолжить работу. Если задача решена, не пишите команд.";
      }

      const hasHiddenSystem = activeChat.messages.some(m => m.isHiddenSystem);
      if (!isRegenerate && systemPrompt && !hasHiddenSystem) {
        activeChat.messages.push({
          role: "system",
          content: systemPrompt,
          isHiddenSystem: true
        });
      }

      let contextText = null;
      let logMsgDiv = null;

      if (!isRegenerate && (activeContext === "page" || activeContext === "all-tabs")) {
        logMsgDiv = displayMessage("system", `[Агент] Извлечение содержимого вкладок...`);
        scrollToBottom();
        contextText = await getTabContext();
        if (logMsgDiv) logMsgDiv.remove();
      }

      if (!isRegenerate && contextText) {
        activeChat.messages.push({
          role: "system",
          content: contextText,
          isHiddenSystem: true
        });
      }

      if (!isRegenerate) {
        activeChat.messages.push({
          role: "user",
          content: text || "Проанализируй этот снимок экрана.",
          screenshot: (activeContext === "vision" && currentScreenshotDataUrl) ? currentScreenshotDataUrl : null
        });

        renderActiveChatMessages();
        clearScreenshot();
        if (activeContext === "vision") {
          document.getElementById("chip-vision").classList.remove("active");
          document.getElementById("chip-none").classList.add("active");
          activeContext = "none";
        }
      }

      const assistantMsg = {
        role: "assistant",
        content: ""
      };
      activeChat.messages.push(assistantMsg);

      const responseDiv = displayMessage("assistant", "...", activeChat.messages.length - 1);
      scrollToBottom();

      const apiMessages = [];
      activeChat.messages.forEach(m => {
        if (m === assistantMsg) return;
        let role = m.role;
        if (role === "system" && apiMessages.length > 0) {
          role = "user";
        }
        let content = m.content;
        let screenshot = null;
        if (m.role === "user" && m.screenshot) {
          screenshot = m.screenshot;
        }
        const lastMsg = apiMessages[apiMessages.length - 1];
        if (lastMsg && lastMsg.role === role) {
          if (screenshot || lastMsg.hasImage) {
            let lastContentArray = Array.isArray(lastMsg.content) ? lastMsg.content : [{ type: "text", text: lastMsg.content }];
            lastContentArray.push({ type: "text", text: content });
            if (screenshot) {
              lastContentArray.push({
                type: "image_url",
                image_url: { url: screenshot }
              });
              lastMsg.hasImage = true;
            }
            lastMsg.content = lastContentArray;
          } else {
            lastMsg.content += "\n\n" + content;
          }
        } else {
          if (screenshot) {
            apiMessages.push({
              role: role,
              content: [
                { type: "text", text: content || "Проанализируй этот снимок экрана." },
                {
                  type: "image_url",
                  image_url: { url: screenshot }
                }
              ],
              hasImage: true
            });
          } else {
            apiMessages.push({
              role: role,
              content: content
            });
          }
        }
      });
      apiMessages.forEach(m => {
        if (m.hasImage !== undefined) {
          delete m.hasImage;
        }
      });

      scrollToBottom();

      let agentLogInterval = null;
      if (isAgentMode) {
        let step = 1;
        const steps = [
          "Инициализация агента...",
          "Парсинг структуры контекста...",
          "Генерация плана выполнения...",
          "Анализ ключевых фрагментов...",
          "Проверка на противоречия...",
          "Формирование ответа..."
        ];
        responseDiv.querySelector(".msg-content").innerHTML = `
          <div class="agent-log">[Агент] Запуск задачи...</div>
        `;
        agentLogInterval = setInterval(() => {
          if (step < steps.length) {
            const logEl = responseDiv.querySelector(".agent-log");
            if (logEl) {
              logEl.textContent = `[Агент] Шаг ${step}: ${steps[step-1]}`;
            }
            step++;
          }
        }, 1500);
      }

      try {
        const response = await fetch("https://api.onlysq.ru/ai/openai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(selectedModel === "deepseek-r1" ? {
            model: selectedModel,
            messages: apiMessages,
            stream: true,
            extra_body: {
              reasoning: currentReasoningLevel
            },
            extra: {
              reasoning: currentReasoningLevel
            },
            request: {
              messages: apiMessages,
              extra: {
                reasoning: currentReasoningLevel
              }
            }
          } : {
            model: selectedModel,
            messages: apiMessages,
            stream: true,
            extra_body: {
              reasoning: currentReasoningLevel
            },
            extra: {
              reasoning: currentReasoningLevel
            }
          })
        });

        if (agentLogInterval) {
          clearInterval(agentLogInterval);
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error ? errData.error.message : `HTTP ${response.status}`;
          throw new Error(errMsg);
        }

        responseDiv.querySelector(".msg-content").innerHTML = "";

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed === "data: [DONE]") continue;

            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.substring(6));
                const delta = parsed.choices[0].delta;
                const chunkText = delta.content || delta.reasoning_content || "";
                if (chunkText) {
                  assistantMsg.content += chunkText;
                  
                  responseDiv.querySelector(".msg-content").innerHTML = "";
                  let rawText = assistantMsg.content.replace(/\[ACTION:\s*OPEN_TAB,\s*url:\s*"([^"]+)"\]/g, "");
                  let thinkText = "";

                  const thinkStart = assistantMsg.content.indexOf("<think>");
                  const thinkEnd = assistantMsg.content.indexOf("</think>");

                  if (thinkStart !== -1 && thinkEnd !== -1 && thinkEnd > thinkStart) {
                    thinkText = assistantMsg.content.substring(thinkStart + 7, thinkEnd).trim();
                    rawText = assistantMsg.content.substring(thinkEnd + 8).replace(/\[ACTION:\s*OPEN_TAB,\s*url:\s*"([^"]+)"\]/g, "").trim();
                  } else if (thinkStart !== -1) {
                    thinkText = assistantMsg.content.substring(thinkStart + 7).trim();
                    rawText = "";
                  }

                  if (thinkText) {
                    const thinkBlock = document.createElement("div");
                    thinkBlock.className = "think-block";
                    
                    const thinkHeader = document.createElement("div");
                    thinkHeader.className = "think-header";
                    thinkHeader.style.cursor = "pointer";
                    thinkHeader.style.userSelect = "none";
                    thinkHeader.style.display = "flex";
                    thinkHeader.style.justifyContent = "space-between";
                    thinkHeader.style.alignItems = "center";
                    thinkHeader.style.width = "100%";
                    thinkHeader.innerHTML = `
                      <div style="display: flex; align-items: center; gap: 4px;">
                        <span class="material-symbols-outlined" style="font-size: 12px !important;">terminal</span>Мысли агента (рассуждение)
                      </div>
                      <span class="think-toggle material-symbols-outlined" style="font-size: 14px !important;">expand_less</span>
                    `;
                    
                    const thinkContent = document.createElement("div");
                    thinkContent.className = "think-content";
                    thinkContent.textContent = thinkText;
                    
                    thinkBlock.appendChild(thinkHeader);
                    thinkBlock.appendChild(thinkContent);
                    responseDiv.querySelector(".msg-content").appendChild(thinkBlock);
                  }

                  if (rawText) {
                    const textSpan = document.createElement("span");
                    textSpan.innerHTML = formatMarkdown(rawText);
                    responseDiv.querySelector(".msg-content").appendChild(textSpan);
                  }
                  
                  scrollToBottom();
                }
              } catch (e) {}
            }
          }
        }

        const actionMatch = assistantMsg.content.match(/\[ACTION:\s*([A-Z_]+)(?:,\s*([\s\S]*?))?\]/);
        if (actionMatch && actionMatch[1]) {
          const actionType = actionMatch[1];
          const args = parseArgs(actionMatch[2]);
          if (isAgentMode && agentStepCount < 5) {
            agentStepCount++;
            if (actionType === "OPEN_TAB") {
              const targetUrl = args.url;
              if (targetUrl) {
                showToast(`[Агент] Шаг ${agentStepCount}: Переход на ${targetUrl}...`, "info");
                chrome.tabs.create({ url: targetUrl, active: false }, (newTab) => {
                  agentTabId = newTab.id;
                  let loaded = false;
                  const listener = (tabId, changeInfo) => {
                    if (tabId === newTab.id && changeInfo.status === 'complete') {
                      loaded = true;
                      chrome.tabs.onUpdated.removeListener(listener);
                      setTimeout(async () => {
                        const res = await extractTabContent(newTab.id);
                        let loadedContent = "";
                        if (res.success) {
                          loadedContent = `[Агент успешно перешел на страницу: "${res.title}" (${res.url})]\n\nСодержимое загруженной страницы:\n${res.content}`;
                        } else {
                          loadedContent = `[Агенту не удалось получить доступ к содержимому страницы ${targetUrl}: ${res.error}]`;
                        }
                        activeChat.messages.push({
                          role: "system",
                          content: loadedContent,
                          isHiddenSystem: true
                        });
                        saveChats();
                        displayMessage("system", `[Агент] Шаг ${agentStepCount}: Страница ${targetUrl} загружена, анализирую содержимое...`);
                        scrollToBottom();
                        sendMessage(true);
                      }, 1500);
                    }
                  };
                  chrome.tabs.onUpdated.addListener(listener);
                  setTimeout(() => {
                    if (!loaded) {
                      chrome.tabs.onUpdated.removeListener(listener);
                      showToast("[Агент] Время ожидания загрузки страницы истекло.", "warning");
                    }
                  }, 15000);
                });
              } else {
                showToast("[Агент] URL не указан для OPEN_TAB", "warning");
              }
            } else if (actionType === "CLICK") {
              const textArg = args.text;
              if (textArg) {
                showToast(`[Агент] Шаг ${agentStepCount}: Клик по элементу "${textArg}"...`, "info");
                getAgentTargetTab().then((targetTabId) => {
                  if (!targetTabId) {
                    showToast("[Агент] Активная вкладка не найдена", "warning");
                    return;
                  }
                  runActionAndExtract(targetTabId, clickElementByText, [textArg]).then((res) => {
                    let logMsg = "";
                    if (res.success) {
                      logMsg = `[Агент выполнил клик по "${textArg}" на странице: "${res.extraction.title}" (${res.extraction.url})]\n\nНовое содержимое страницы:\n${res.extraction.content}`;
                    } else {
                      logMsg = `[Агенту не удалось выполнить клик по "${textArg}": ${res.error}]`;
                    }
                    activeChat.messages.push({
                      role: "system",
                      content: logMsg,
                      isHiddenSystem: true
                    });
                    saveChats();
                    displayMessage("system", `[Агент] Шаг ${agentStepCount}: Выполнен клик по "${textArg}", анализирую содержимое...`);
                    scrollToBottom();
                    sendMessage(true);
                  });
                });
              } else {
                showToast("[Агент] Текст элемента не указан для CLICK", "warning");
              }
            } else if (actionType === "SCROLL") {
              const directionArg = args.direction || "down";
              showToast(`[Агент] Шаг ${agentStepCount}: Прокрутка страницы ${directionArg}...`, "info");
              getAgentTargetTab().then((targetTabId) => {
                if (!targetTabId) {
                  showToast("[Агент] Активная вкладка не найдена", "warning");
                  return;
                }
                runActionAndExtract(targetTabId, scrollPage, [directionArg]).then((res) => {
                  let logMsg = "";
                  if (res.success) {
                    logMsg = `[Агент выполнил прокрутку ${directionArg} на странице: "${res.extraction.title}" (${res.extraction.url})]\n\nНовое содержимое страницы:\n${res.extraction.content}`;
                  } else {
                    logMsg = `[Агенту не удалось выполнить прокрутку ${directionArg}: ${res.error}]`;
                  }
                  activeChat.messages.push({
                    role: "system",
                    content: logMsg,
                    isHiddenSystem: true
                  });
                  saveChats();
                  displayMessage("system", `[Агент] Шаг ${agentStepCount}: Выполнена прокрутка ${directionArg}, анализирую содержимое...`);
                  scrollToBottom();
                  sendMessage(true);
                });
              });
            } else if (actionType === "WAIT") {
              const seconds = Math.min(Math.max(parseInt(args.seconds) || 2, 1), 10);
              showToast(`[Агент] Шаг ${agentStepCount}: Ожидание ${seconds} сек...`, "info");
              getAgentTargetTab().then((targetTabId) => {
                if (!targetTabId) {
                  showToast("[Агент] Активная вкладка не найдена", "warning");
                  return;
                }
                setTimeout(() => {
                  extractTabContent(targetTabId).then((res) => {
                    let logMsg = "";
                    if (res.success) {
                      logMsg = `[Агент подождал ${seconds} сек. на странице: "${res.title}" (${res.url})]\n\nСодержимое страницы:\n${res.content}`;
                    } else {
                      logMsg = `[Агенту не удалось прочитать страницу после ожидания: ${res.error}]`;
                    }
                    activeChat.messages.push({
                      role: "system",
                      content: logMsg,
                      isHiddenSystem: true
                    });
                    saveChats();
                    displayMessage("system", `[Агент] Шаг ${agentStepCount}: Ожидание завершено, анализирую содержимое...`);
                    scrollToBottom();
                    sendMessage(true);
                  });
                }, seconds * 1000);
              });
            } else if (actionType === "CLOSE_TAB") {
              showToast(`[Агент] Шаг ${agentStepCount}: Закрытие вкладки...`, "info");
              if (agentTabId !== null) {
                chrome.tabs.remove(agentTabId, () => {
                  if (chrome.runtime.lastError) {}
                  agentTabId = null;
                  activeChat.messages.push({
                    role: "system",
                    content: "[Агент закрыл временную вкладку. Текущая вкладка закрыта, контекст пуст. Подведите итоги или спросите пользователя о дальнейших действиях.]",
                    isHiddenSystem: true
                  });
                  saveChats();
                  displayMessage("system", `[Агент] Шаг ${agentStepCount}: Вкладка закрыта.`);
                  scrollToBottom();
                  sendMessage(true);
                });
              } else {
                showToast("[Агент] Нет открытой агентом вкладки для закрытия", "warning");
              }
            } else {
              showToast(`[Агент] Неизвестное действие: ${actionType}`, "warning");
            }
          } else {
            if (actionType === "OPEN_TAB" && args.url) {
              showToast(`Открываю вкладку: ${args.url}`, "success");
              chrome.tabs.create({ url: args.url });
            } else {
              showToast(`Для выполнения действия ${actionType} включите Агентный режим.`, "warning");
            }
          }
        }

        saveChats();
        renderChatsList();

      } catch (err) {
        if (agentLogInterval) clearInterval(agentLogInterval);
        responseDiv.querySelector(".msg-content").innerHTML = `<span style="color: var(--color-error);">Ошибка запроса: ${err.message}</span>`;
        assistantMsg.content = `Ошибка запроса: ${err.message}`;
        saveChats();
      }
    });
  }

  function parseArgs(argsStr) {
    const args = {};
    if (!argsStr) return args;
    const regex = /(\w+)\s*:\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let match;
    while ((match = regex.exec(argsStr)) !== null) {
      const key = match[1];
      const val = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : match[4]);
      args[key] = val;
    }
    return args;
  }

  function getAgentTargetTab() {
    return new Promise((resolve) => {
      if (agentTabId !== null) {
        chrome.tabs.get(agentTabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            agentTabId = null;
            fallbackToActiveTab(resolve);
          } else {
            resolve(agentTabId);
          }
        });
      } else {
        fallbackToActiveTab(resolve);
      }
    });
  }

  function fallbackToActiveTab(resolve) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        resolve(tabs[0].id);
      } else {
        resolve(null);
      }
    });
  }

  function extractTabContent(tabId) {
    return new Promise((resolve) => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          if (!document || !document.body) {
            return { title: "", url: window.location.href, content: "Пустая страница" };
          }
          const cloned = document.body.cloneNode(true);
          const links = cloned.querySelectorAll("a");
          links.forEach(l => {
            const href = l.getAttribute("href");
            if (href) {
              try {
                const absoluteUrl = new URL(href, window.location.href).href;
                const text = l.innerText.trim();
                if (text && absoluteUrl.startsWith("http")) {
                  l.innerText = `${text} (${absoluteUrl})`;
                }
              } catch (e) {}
            }
          });
          const toRemove = cloned.querySelectorAll("script, style, noscript, iframe, svg");
          toRemove.forEach(el => el.remove());
          return {
            title: document.title,
            url: window.location.href,
            content: cloned.innerText.replace(/\s+/g, " ").trim().substring(0, 30000)
          };
        }
      }, (results) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else if (results && results[0] && results[0].result) {
          resolve({ success: true, ...results[0].result });
        } else {
          resolve({ success: false, error: "Не удалось получить результат" });
        }
      });
    });
  }

  function clickElementByText(text) {
    const lowerText = text.toLowerCase().trim();
    const elements = Array.from(document.querySelectorAll("a, button, [role='button'], input[type='button'], input[type='submit']"));
    let target = elements.find(el => el.textContent.toLowerCase().trim() === lowerText);
    if (!target) {
      target = elements.find(el => el.textContent.toLowerCase().includes(lowerText));
    }
    if (!target) {
      const allTextElements = Array.from(document.querySelectorAll("span, div, p, li"));
      target = allTextElements.find(el => el.textContent.toLowerCase().trim() === lowerText);
      if (!target) {
        target = allTextElements.find(el => el.textContent.toLowerCase().includes(lowerText));
      }
    }
    if (target) {
      target.scrollIntoView({ block: "center", inline: "center" });
      const event = new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true
      });
      target.dispatchEvent(event);
      if (typeof target.click === "function") {
        target.click();
      }
      return { success: true, text: target.textContent.trim(), tagName: target.tagName };
    }
    return { success: false, error: "Элемент не найден" };
  }

  function scrollPage(direction) {
    try {
      const distance = window.innerHeight * 0.8;
      if (direction === "down") {
        window.scrollBy({ top: distance, behavior: "smooth" });
      } else if (direction === "up") {
        window.scrollBy({ top: -distance, behavior: "smooth" });
      }
      return { success: true, direction: direction };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function runActionAndExtract(tabId, actionFunc, actionArgs) {
    return new Promise((resolve) => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: actionFunc,
        args: actionArgs
      }, (results) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        const actionRes = (results && results[0]) ? results[0].result : { success: false, error: "Нет ответа" };
        if (actionRes && !actionRes.success) {
          resolve({ success: false, error: actionRes.error });
          return;
        }
        let isNavigating = false;
        let onUpdatedListener;
        const timeoutId = setTimeout(() => {
          if (onUpdatedListener) {
            chrome.tabs.onUpdated.removeListener(onUpdatedListener);
          }
          setTimeout(async () => {
            const extraction = await extractTabContent(tabId);
            resolve({
              success: true,
              actionResult: actionRes,
              extraction: extraction
            });
          }, 1000);
        }, 1000);
        onUpdatedListener = (updatedTabId, changeInfo) => {
          if (updatedTabId === tabId && changeInfo.status === 'loading') {
            isNavigating = true;
            clearTimeout(timeoutId);
            chrome.tabs.onUpdated.removeListener(onUpdatedListener);
            const completeListener = (tId, chInfo) => {
              if (tId === tabId && chInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(completeListener);
                setTimeout(async () => {
                  const extraction = await extractTabContent(tabId);
                  resolve({
                    success: true,
                    actionResult: actionRes,
                    extraction: extraction
                  });
                }, 1500);
              }
            };
            chrome.tabs.onUpdated.addListener(completeListener);
            setTimeout(() => {
              chrome.tabs.onUpdated.removeListener(completeListener);
              resolve({
                success: false,
                error: "Превышено время ожидания загрузки страницы"
              });
            }, 15000);
          }
        };
        chrome.tabs.onUpdated.addListener(onUpdatedListener);
      });
    });
  }

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
