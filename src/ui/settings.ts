import {
  App,
  PluginSettingTab,
  SettingDefinitionItem,
} from 'obsidian';
import type CopyExportPlugin from '../main';

export class CopyExportSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CopyExportPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: 'Default copy format',
        desc: 'Format preselected when copying content.',
        control: {
          type: 'dropdown' as const,
          key: 'defaultCopyFormat',
          options: {
            markdown: 'Markdown',
            text: 'Plain text',
            html: 'Formatted text (HTML / rich text)',
          },
        },
      },
      {
        name: 'Default export format',
        desc: 'Format preselected when exporting a file.',
        control: {
          type: 'dropdown' as const,
          key: 'defaultExportFormat',
          options: {
            pdf: 'PDF',
            markdown: 'Markdown',
            text: 'Plain text',
            html: 'Formatted text (HTML)',
          },
        },
      },
      {
        name: 'Experimental Outline integration',
        desc: 'Adds a small Copy and Export action to built-in Outline rows. This uses internal DOM structure and may break after Obsidian updates.',
        render: (setting: import('obsidian').Setting): void => {
          setting.addToggle((toggle) =>
            toggle
              .setValue(
                this.plugin.settings.enableExperimentalOutline,
              )
              .onChange(async (enabled) => {
                this.plugin.settings.enableExperimentalOutline = enabled;

                await this.plugin.saveSettings();
                this.plugin.refreshExperimentalOutline();
              }),
          );
        },
      },
    ];
  }
}
