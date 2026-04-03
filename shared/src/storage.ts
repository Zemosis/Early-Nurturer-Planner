/**
 * Platform-agnostic storage interface.
 * Web injects localStorage, mobile injects AsyncStorage (sync wrapper).
 */
export interface StorageProvider {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
