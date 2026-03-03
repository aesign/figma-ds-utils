import { Networker } from "monorepo-networker";

export const UI = Networker.createSide("UI-side").listens<{
  ping(): "pong";
  hello(text: string): void;
  
  // Selection state management
  "selection-state"(data: { count: number }): void;
  "selection-replace-preview"(data: { affected: number; nodes: number }): void;
  
  // Collections and variables
  "collections-loaded"(collections: any[]): void;
  "groups-loaded"(groups: string[]): void;
  "modes-loaded"(modes: any[]): void;
  
  // JSON Editor
  "text-nodes-loaded"(nodes: any[]): void;
  "all-variables-loaded"(variables: any[]): void;
  "variable-applied"(): void;
  "error"(error: { message: string }): void;
}>();

export const PLUGIN = Networker.createSide("Plugin-side").listens<{
  ping(): "pong";
  hello(text: string): void;
  createRect(width: number, height: number): void;
  exportSelection(): Promise<string>;
  
  // Selection Variables
  "request-selection-state"(): void;
  "selection-find-replace-bound-vars-preview"(data: { find: string }): void;
  "selection-find-replace-bound-vars"(data: { find: string; replace: string }): void;
  
  // Alias Find & Replace
  "preview-alias-prefix-impact"(data: { prefix: string }): void;
  "apply-alias-prefix-change"(data: { prefix: string; newPrefix: string }): void;
  
  // Duplicate & Rename
  "request-collections"(): void;
  "get-groups-for-dup"(data: { collectionName: string }): void;
  "duplicate-rename-preview"(data: { collectionName: string; groupName: string; find: string }): void;
  "duplicate-rename-apply"(data: { collectionName: string; groupName: string; find: string; replace: string }): void;
  
  // Documentation
  "generate-documentation"(data: { collection?: string; insertMode?: string }): void;
  "remove-documentation"(data: { scope?: string }): void;
  "set-figma-file-link"(data: { fileUrl: string }): void;
  
  // Color Stops
  "add-color-stop"(data: { colorCollection?: string; colorGroup?: string; colorValue?: string }): void;
  
  // I18n Export
  "export-i18n"(data: { i18nCollection?: string }): void;
  
  // JSON Editor
  "load-collections"(): void;
  "load-collection-data"(data: { collectionName: string }): void;
  "save-collection-data"(data: { collectionName: string; data: any }): void;
  "resize"(data: { size: { w: number; h: number } }): void;
  "get-text-nodes"(): void;
  "apply-variable-to-node"(data: { nodeId: string; variableName: string }): void;
  "create-new-variable"(data: { nodes: any[] }): void;
  "batch-assign-variables"(data: { nodes: any[] }): void;
  "select-and-zoom-to-node"(data: { nodeId: string }): void;
  "start-selection-listener"(): void;
  "get-all-variables"(): void;
  "create-variable-and-apply"(data: { nodeId: string; variableName: string }): void;
  
  // Dev Status
  "set-dev-status"(data: { devStatus?: string }): void;
}>();
