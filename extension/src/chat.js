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

  await vscode.env.clipboard.writeText(prompt);

  if (await tryCommand("workbench.action.chat.open", { query: prompt })) {
    return { ok: true, via: "workbench.action.chat.open" };
  }
  if (await tryCommand("workbench.action.chat.open", prompt)) {
    return { ok: true, via: "workbench.action.chat.open:string" };
  }
  if (await tryCommand("workbench.action.chat.newChat", { query: prompt })) {
    return { ok: true, via: "workbench.action.chat.newChat" };
  }
  if (await tryCommand("workbench.action.chat.newChat")) {
    await tryCommand("workbench.action.chat.open", { query: prompt });
    return { ok: true, via: "workbench.action.chat.newChat+open" };
  }
  if (await tryCommand("aichat.newchataction")) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await tryCommand("editor.action.clipboardPasteAction");
    vscode.window.showInformationMessage("Opened chat. If the prompt is empty, paste (Cmd+V).");
    return { ok: true, via: "aichat.newchataction" };
  }
  if (await tryCommand("composer.startComposer")) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await tryCommand("editor.action.clipboardPasteAction");
    vscode.window.showInformationMessage("Opened composer. If the prompt is empty, paste (Cmd+V).");
    return { ok: true, via: "composer.startComposer" };
  }

  vscode.window.showInformationMessage("Prompt copied. Paste it in chat (Cmd+V).");
  return { ok: true, via: "clipboard" };
}

module.exports = { fillChat };
