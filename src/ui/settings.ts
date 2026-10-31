import { App, PluginSettingTab, Setting } from 'obsidian';
import type CopyExportPlugin from '../main';
import type { CopyFormat, ExportFormat } from '../types/settings';

export class CopyExportSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CopyExportPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Default copy format')
      .setDesc('Format preselected when copying content.')
      .addDropdown((dropdown) => dropdown
        .addOption('markdown', 'Markdown')
        .addOption('text', 'Plain text')
        .addOption('html', 'Formatted text (HTML / rich text)')
        .setValue(this.plugin.settings.defaultCopyFormat)
        .onChange(async (value) => {
          this.plugin.settings.defaultCopyFormat = value as CopyFormat;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default export format')
      .setDesc('Format preselected when exporting a file.')
      .addDropdown((dropdown) => dropdown
        .addOption('pdf', 'PDF')
        .addOption('markdown', 'Markdown')
        .addOption('text', 'Plain text')
        .addOption('html', 'Formatted text (HTML)')
        .setValue(this.plugin.settings.defaultExportFormat)
        .onChange(async (value) => {
          this.plugin.settings.defaultExportFormat = value as ExportFormat;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Image folder')
      .setDesc('Vault folder used when saving images.')
      .addText((text) => text
        .setPlaceholder('Attachments')
        .setValue(this.plugin.settings.imageFolder)
        .onChange(async (value) => {
          this.plugin.settings.imageFolder = value.trim() || 'Attachments';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Experimental Outline integration')
      .setDesc('Adds a small Copy and Export action to built-in Outline rows. This uses internal DOM structure and may break after Obsidian updates.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.enableExperimentalOutline)
        .onChange(async (enabled) => {
          this.plugin.settings.enableExperimentalOutline = enabled;
          await this.plugin.saveSettings();
          this.plugin.refreshExperimentalOutline();
        }));
  }
}
