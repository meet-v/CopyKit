export type CopyFormat = 'markdown' | 'text' | 'html';
export type ExportFormat = 'markdown' | 'text' | 'html' | 'pdf';
export type TableFormat = 'markdown' | 'html' | 'csv' | 'tsv';

export interface CopyExportSettings {
  defaultCopyFormat: CopyFormat;
  defaultExportFormat: ExportFormat;
  imageFolder: string;
  enableExperimentalOutline: boolean;
}

export const DEFAULT_SETTINGS: CopyExportSettings = {
  defaultCopyFormat: 'markdown',
  defaultExportFormat: 'pdf',
  imageFolder: 'Attachments',
  enableExperimentalOutline: false,
};
