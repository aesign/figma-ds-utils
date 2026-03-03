import { PLUGIN, UI } from "@common/networkSides";
import { PLUGIN_CHANNEL } from "@plugin/plugin.network";
import { Networker } from "monorepo-networker";

// Import all our DS Utils features
import { runAliasFindReplacePlugin } from "./features/alias-find-replace";
import { runSelectionVariablesPlugin } from "./features/selection-variables";
import { runDuplicateRenamePlugin } from "./features/duplicate-rename";
import { runGenerateDocumentationCommand } from "./features/documentation";
import { runRemoveDocumentationCommand } from "./features/documentation";
import { runSetFigmaFileLinkCommand } from "./features/documentation";
import { runAddColorStopCommand } from "./features/color-stops";
import { runExportI18nCommand } from "./features/i18n-export";
import { runSetDevStatusCommand } from "./features/dev-status";
import { runAddPalettePlugin } from "./features/add-palette";
import { runMapPalettePlugin } from "./features/map-palette";
import { runCopyAliasesPlugin } from "./features/copy-aliases";
import { runCopyModePlugin } from "./features/copy-mode";
import { runMapVariablesPlugin } from "./features/map-variables";

// Parameter input handlers
import {
  handleCollectionInput,
  handleFileUrlInput,
  handleInsertModeInput,
  handleScopeInput,
  handleColorCollectionInput,
  handleColorGroupInput,
  handleColorValueInput,
  handleI18nCollectionInput,
  handleDevStatusInput,
} from "../main";

async function bootstrap() {
  Networker.initialize(PLUGIN, PLUGIN_CHANNEL);

  console.log('🚀 DS Utils Plugin starting...');

  // UI will be shown by individual commands when needed
  // Don't show UI here in bootstrap
  
  // Parameter input handlers
  figma.parameters.on('input', ({ key, query, result }) => {
    switch (key) {
      case 'collection':
        return handleCollectionInput(query, result);
      case 'fileUrl':
        return handleFileUrlInput(query, result);
      case 'insertMode':
        return handleInsertModeInput(query, result);
      case 'scope':
        return handleScopeInput(query, result);
      case 'colorCollection':
        return handleColorCollectionInput(query, result);
      case 'colorGroup':
        return handleColorGroupInput(query, result);
      case 'colorValue':
        return handleColorValueInput(query, result);
      case 'i18nCollection':
        return handleI18nCollectionInput(query, result);
      case 'devStatus':
        return handleDevStatusInput(query, result);
    }
  });

  // Command routing
  figma.on('run', async ({ command, parameters }) => {
    console.log('📋 Command:', command);
    console.log('⚙️ Parameters:', parameters);
    
    switch (command) {
      case 'alias-find-replace':
        console.log('🎯 Running Alias Find & Replace plugin...');
        runAliasFindReplacePlugin();
        break;
      case 'selection-variables':
        console.log('🎯 Running Selection Variables plugin...');
        // Show UI first, then initialize the feature
        if (figma.editorType === "figma") {
          figma.showUI(__html__, {
            width: 420,
            height: 300,
            title: "DS Utils - Selection Variables",
            themeColors: true,
          });
        }
        runSelectionVariablesPlugin();
        break;
      case 'duplicate-rename':
        console.log('🎯 Running Duplicate & Rename plugin...');
        runDuplicateRenamePlugin();
        break;
      case 'generate-documentation':
        console.log('📖 Running Generate Documentation command...');
        if (parameters) {
          console.log('📝 Collection parameter:', parameters.collection);
          console.log('📝 Insert mode parameter:', parameters.insertMode);
          runGenerateDocumentationCommand(parameters.collection, parameters.insertMode);
        } else {
          console.log('❌ No parameters provided for generate-documentation');
          figma.notify('No collection selected. Please try again.');
          figma.closePlugin();
        }
        break;
      case 'set-figma-file-link':
        console.log('🔗 Running Set Figma File Link command...');
        if (parameters) {
          console.log('📝 File URL parameter:', parameters.fileUrl);
          await runSetFigmaFileLinkCommand(parameters.fileUrl);
        } else {
          console.log('❌ No parameters provided for set-figma-file-link');
          figma.notify('No file URL provided. Please try again.');
          figma.closePlugin();
        }
        break;
      case 'remove-documentation':
        console.log('🗑️ Running Remove Documentation command...');
        if (parameters) {
          console.log('📝 Scope parameter:', parameters.scope);
          await runRemoveDocumentationCommand(parameters.scope);
        } else {
          console.log('❌ No parameters provided for remove-documentation');
          figma.notify('No scope selected. Please try again.');
          figma.closePlugin();
        }
        break;
      case 'add-color-stop':
        console.log('🎨 Running Add Color Stop command...');
        if (parameters) {
          console.log('📝 Color collection parameter:', parameters.colorCollection);
          console.log('📝 Color group parameter:', parameters.colorGroup);
          console.log('📝 Color value parameter:', parameters.colorValue);
          await runAddColorStopCommand(parameters.colorCollection, parameters.colorGroup, parameters.colorValue);
        } else {
          console.log('❌ No parameters provided for add-color-stop');
          figma.notify('No color parameters provided. Please try again.');
          figma.closePlugin();
        }
        break;
      case 'add-palette':
        console.log('🎨 Running Add Palette plugin...');
        runAddPalettePlugin();
        break;
      case 'map-palette':
        console.log('🎨 Running Map Palette plugin...');
        runMapPalettePlugin();
        break;
      case 'copy-aliases':
        console.log('🔁 Running Copy Aliases plugin...');
        runCopyAliasesPlugin();
        break;
      case 'copy-mode':
        console.log('🧭 Running Copy Mode plugin...');
        runCopyModePlugin();
        break;
      case 'map-variables':
        console.log('🧩 Running Map Variables plugin...');
        runMapVariablesPlugin();
        break;
      case 'export-i18n':
        console.log('🌐 Running Export I18n command...');
        if (parameters) {
          console.log('📝 I18n collection parameter:', parameters.i18nCollection);
          await runExportI18nCommand(parameters.i18nCollection);
        } else {
          console.log('❌ No parameters provided for export-i18n');
          figma.notify('No collection selected. Please try again.');
          figma.closePlugin();
        }
        break;
      case 'set-dev-status':
        console.log('🏷️ Running Set Dev Status command...');
        if (parameters) {
          console.log('📝 Dev status parameter:', parameters.devStatus);
          await runSetDevStatusCommand(parameters.devStatus);
        } else {
          console.log('❌ No parameters provided for set-dev-status');
          figma.notify('No status selected. Please try again.');
          figma.closePlugin();
        }
        break;
      default:
        console.log('❓ Unknown command:', command);
        figma.notify(`Unknown command: ${command}`);
        figma.closePlugin();
    }
  });

  console.log("✅ DS Utils bootstrapped @", Networker.getCurrentSide().name);
}

bootstrap();
