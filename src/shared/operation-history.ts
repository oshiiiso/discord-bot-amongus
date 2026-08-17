import { APP_CONFIG } from './app-config';
import { OperationHistoryEntry } from './types';

export class OperationHistory {
  private entries: OperationHistoryEntry[] = [];

  add(entry: Omit<OperationHistoryEntry, 'id'>): OperationHistoryEntry {
    const record: OperationHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    this.entries.unshift(record);
    if (this.entries.length > APP_CONFIG.operationHistoryLimit) {
      this.entries.length = APP_CONFIG.operationHistoryLimit;
    }

    return record;
  }

  list(): OperationHistoryEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}

export const operationHistory = new OperationHistory();
