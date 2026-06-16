chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    try {
      const clonedBody = document.body.cloneNode(true);
      const links = clonedBody.querySelectorAll("a");
      links.forEach(link => {
        const href = link.getAttribute("href");
        if (href) {
          try {
            const absoluteUrl = new URL(href, window.location.href).href;
            const text = link.innerText.trim();
            if (text && absoluteUrl.startsWith("http")) {
              link.innerText = `${text} (${absoluteUrl})`;
            }
          } catch (e) {}
        }
      });
      const elementsToRemove = clonedBody.querySelectorAll("script, style, noscript, iframe, svg");
      elementsToRemove.forEach(el => el.remove());
      sendResponse({
        success: true,
        title: document.title,
        url: window.location.href,
        content: clonedBody.innerText.replace(/\s+/g, " ").trim().substring(0, 60000)
      });
    } catch (err) {
      sendResponse({
        success: false,
        error: err.message
      });
    }
  }
  return true;
});
