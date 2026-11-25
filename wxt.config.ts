import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Fill Pro - AI-powered form filler for developers and QA engineers',
    short_name: 'Fill Pro',
    description: 'AI-powered form filler for developers and QA engineers. Generate realistic test data, smart file attachments, and test forms faster.',
    version: '2.0.0',
    manifest_version: 3,
    permissions: [
      'activeTab',
      'scripting',
      'storage',
      'sidePanel',
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
