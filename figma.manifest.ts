// https://www.figma.com/plugin-docs/manifest/
export default {
  name: "DS Utilities",
  id: "1538162543343522827",
  api: "1.0.0",
  main: "plugin.js",
  ui: "index.html",
  capabilities: [],
  enableProposedApi: false,
  documentAccess: "dynamic-page",
  editorType: ["figma"],
  permissions: ["teamlibrary"],
  networkAccess: {
    allowedDomains: ["https://cdn.jsdelivr.net"]
  },
  menu: [
    {
      name: "Alias Find & Replace",
      command: "alias-find-replace"
    },
    {
      name: "Selection Variables",
      command: "selection-variables"
    },
    {
      name: "Duplicate & Rename",
      command: "duplicate-rename"
    },
    {
      name: "Generate Documentation",
      command: "generate-documentation",
      parameters: [
        {
          name: "Collection",
          key: "collection"
        },
        {
          name: "Insert Mode",
          key: "insertMode"
        }
      ]
    },
    {
      name: "Remove Documentation",
      command: "remove-documentation",
      parameters: [
        {
          name: "Scope",
          key: "scope"
        }
      ]
    },
    {
      name: "Set Figma File Link",
      command: "set-figma-file-link",
      parameters: [
        {
          name: "Figma File URL",
          key: "fileUrl",
          allowFreeform: true
        }
      ]
    },
    {
      name: "Add Color Stop",
      command: "add-color-stop",
      parameters: [
        {
          name: "Collection",
          key: "colorCollection"
        },
        {
          name: "Group",
          key: "colorGroup"
        },
        {
          name: "Value",
          key: "colorValue",
          allowFreeform: true
        }
      ]
    },
    {
      name: "Add Palette",
      command: "add-palette"
    },
    {
      name: "Map Palette",
      command: "map-palette"
    },
    {
      name: "Copy Aliases",
      command: "copy-aliases"
    },
    {
      name: "Copy Mode",
      command: "copy-mode"
    },
    {
      name: "Map Variables",
      command: "map-variables"
    },
    {
      name: "Export I18n",
      command: "export-i18n",
      parameters: [
        {
          name: "Collection",
          key: "i18nCollection"
        }
      ]
    },
    {
      name: "Set Dev Status",
      command: "set-dev-status",
      parameters: [
        {
          name: "Status",
          key: "devStatus"
        }
      ]
    },
    {
      name: "Analyze Collections",
      command: "analyze-collections"
    }
  ]
};
