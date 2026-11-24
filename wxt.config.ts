import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Fill Pro',
    short_name: 'Fill Pro',
    description: 'Understand Forms. Generate Data. Test Faster. AI-powered intelligent form filling for developers and QA engineers.',
    version: '1.0.0',
    manifest_version: 3,
    permissions: [
      'activeTab',
      'scripting',
      'storage',
      'sidePanel',
      'tabs',
    ],
    host_permissions: [
      '<all_urls>',
    ],
    action: {
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      },
    },
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    commands: {
      '_execute_action': {
        suggested_key: {
          default: 'Alt+Shift+F',
          mac: 'Alt+Shift+F',
        },
        description: 'Open Fill Pro',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
  vite: () => ({
    build: {
      target: 'esnext',
    },
  }),
});
