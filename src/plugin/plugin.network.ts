import { PLUGIN, UI } from "@common/networkSides";
import { sendSelectionState } from "./utils";

export const PLUGIN_CHANNEL = PLUGIN.channelBuilder()
  .emitsTo(UI, (message) => {
    figma.ui.postMessage(message);
  })
  .receivesFrom(UI, (next) => {
    const listener: MessageEventHandler = (event) => next(event);
    figma.ui.on("message", listener);
    return () => figma.ui.off("message", listener);
  })
  .startListening();

// ---------- Original demo handlers

PLUGIN_CHANNEL.registerMessageHandler("ping", () => {
  return "pong";
});

PLUGIN_CHANNEL.registerMessageHandler("hello", (text) => {
  console.log("UI side said:", text);
});

PLUGIN_CHANNEL.registerMessageHandler("createRect", (width, height) => {
  if (figma.editorType === "figma") {
    const rect = figma.createRectangle();
    rect.x = 0;
    rect.y = 0;
    rect.name = "Plugin Rectangle # " + Math.floor(Math.random() * 9999);
    rect.fills = [
      {
        type: "SOLID",
        color: {
          r: Math.random(),
          g: Math.random(),
          b: Math.random(),
        },
      },
    ];
    rect.resize(width, height);
    figma.currentPage.appendChild(rect);
    figma.viewport.scrollAndZoomIntoView([rect]);
    figma.closePlugin();
  }
});

PLUGIN_CHANNEL.registerMessageHandler("exportSelection", async () => {
  const selectedNodes = figma.currentPage.selection;
  if (selectedNodes.length === 0) {
    throw new Error("No selection is present.");
  }

  const selection = selectedNodes[0];
  const bytes = await selection.exportAsync({
    format: "PNG",
    contentsOnly: false,
  });

  return "data:image/png;base64," + figma.base64Encode(bytes);
});

// ---------- DS Utils handlers

// Selection Variables handlers
PLUGIN_CHANNEL.registerMessageHandler("request-selection-state", () => {
  sendSelectionState();
});

PLUGIN_CHANNEL.registerMessageHandler("selection-find-replace-bound-vars-preview", async (data) => {
  // Import and call the handler from selection-variables feature
  const selectionVars = await import("./features/selection-variables");
  return await selectionVars.handleSelectionFindReplacePreview(data);
});

PLUGIN_CHANNEL.registerMessageHandler("selection-find-replace-bound-vars", async (data) => {
  // Import and call the handler from selection-variables feature  
  const selectionVars = await import("./features/selection-variables");
  return await selectionVars.handleSelectionFindReplace(data);
});

// Set up selection change listener for Selection Variables
figma.on('selectionchange', () => {
  sendSelectionState();
});
