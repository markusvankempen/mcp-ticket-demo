const vscode = require("vscode");

async function tryCommand(id, arg) {
  try {
    if (arg === undefined) await vscode.commands.executeCommand(id);
    else await vscode.commands.executeCommand(id, arg);
    return true;
  } catch {
    return false;
  }
}

/**
 * File a prompt into the editor's LLM chat (VS Code / Cursor / Bob).
 * Tries the chat APIs first; copies to the clipboard if none accept the query.
 */
async function fillChat(text) {
  const prompt = String(text || "").trim();
  if (!prompt) {
    vscode.window.showWarningMessage("Type a prompt first.");
    return { ok: false };
  }

  // Set the clipboard so paste fallback works instantly
  await vscode.env.clipboard.writeText(prompt);

  // 1. Try VS Code Chat with auto-submit options if supported
  if (await tryCommand("workbench.action.chat.open", { query: prompt, submit: true })) {
    return { ok: true, via: "workbench.action.chat.open:query+submit" };
  }
  if (await tryCommand("workbench.action.chat.open", { query: prompt })) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await tryCommand("workbench.action.chat.submit");
    return { ok: true, via: "workbench.action.chat.open:query" };
  }
  if (await tryCommand("workbench.action.chat.open", prompt)) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await tryCommand("workbench.action.chat.submit");
    return { ok: true, via: "workbench.action.chat.open:string" };
  }
  if (await tryCommand("workbench.action.chat.newChat", { query: prompt, submit: true })) {
    return { ok: true, via: "workbench.action.chat.newChat:query+submit" };
  }
  if (await tryCommand("workbench.action.chat.newChat", { query: prompt })) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await tryCommand("workbench.action.chat.submit");
    return { ok: true, via: "workbench.action.chat.newChat:query" };
  }

  // 2. Try Inline Chat (often used for quick queries)
  if (await tryCommand("inlineChat.start", { query: prompt })) {
    return { ok: true, via: "inlineChat.start:query" };
  }
  if (await tryCommand("editor.action.inlineChat.start", { query: prompt })) {
    return { ok: true, via: "editor.action.inlineChat.start:query" };
  }

  // 3. Try IBM Bob IDE
  // Bob.newChat opens a fresh chat and accepts a query string directly (Bob ≥ 1.x).
  if (await tryCommand("Bob.newChat", prompt)) {
    return { ok: true, via: "Bob.newChat:string" };
  }
  // Fallback: focus the Bob input box, type the prompt text, then submit.
  // editor.action.clipboardPasteAction targets the code editor, not the chat input,
  // so we use the `type` command which routes keystrokes to the focused widget.
  if (await tryCommand("Bob.focus")) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await tryCommand("type", { text: prompt });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await tryCommand("Bob.acceptInput");
    return { ok: true, via: "Bob.focus+type+acceptInput" };
  }

  // 4. Try Windsurf (Codeium) Cascade
  if (await tryCommand("windsurf.openCascade", { query: prompt })) {
    return { ok: true, via: "windsurf.openCascade:query" };
  }
  if (await tryCommand("windsurf.openCascade", { text: prompt })) {
    return { ok: true, via: "windsurf.openCascade:text" };
  }
  if (await tryCommand("windsurf.openCascade")) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await tryCommand("editor.action.clipboardPasteAction");
    return { ok: true, via: "windsurf.openCascade:paste" };
  }

  // 5. Try Cursor AI Chat
  if (await tryCommand("aichat.newchataction", { query: prompt })) {
    return { ok: true, via: "aichat.newchataction:query" };
  }
  if (await tryCommand("aichat.newchataction", { text: prompt })) {
    return { ok: true, via: "aichat.newchataction:text" };
  }
  if (await tryCommand("aichat.newchataction")) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await tryCommand("editor.action.clipboardPasteAction");
    return { ok: true, via: "aichat.newchataction:paste" };
  }

  // 6. Try Cursor Composer
  if (await tryCommand("composer.startComposer", { query: prompt })) {
    return { ok: true, via: "composer.startComposer:query" };
  }
  if (await tryCommand("composer.startComposer", { text: prompt })) {
    return { ok: true, via: "composer.startComposer:text" };
  }
  if (await tryCommand("composer.startComposer")) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await tryCommand("editor.action.clipboardPasteAction");
    return { ok: true, via: "composer.startComposer:paste" };
  }

  // 7. Generic VS Code Chat fallback with focus + paste + submit
  if (await tryCommand("workbench.action.chat.newChat")) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await tryCommand("workbench.action.chat.focusInput");
    await tryCommand("editor.action.clipboardPasteAction");
    await tryCommand("workbench.action.chat.submit");
    return { ok: true, via: "workbench.action.chat.newChat+focus+paste+submit" };
  }

  vscode.window.showInformationMessage("Prompt copied. Paste it in chat (Cmd+V).");
  return { ok: true, via: "clipboard" };
}

module.exports = { fillChat };
