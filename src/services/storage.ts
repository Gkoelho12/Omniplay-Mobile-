/* OmniPlay Mobile · Armazenamento Persistente (AsyncStorage + cache em memória) */
import AsyncStorage from '@react-native-async-storage/async-storage';

const memCache: Record<string, string> = {};
let initialized = false;

export const LS = {
  async init(): Promise<void> {
    if (initialized) return;
    try {
      const keys = await AsyncStorage.getAllKeys();
      const omniKeys = keys.filter((k) => k.startsWith('omni.'));
      if (omniKeys.length > 0) {
        const pairs = await AsyncStorage.multiGet(omniKeys);
        for (const [k, v] of pairs) {
          if (k && v != null) memCache[k] = v;
        }
      }
    } catch {
      // Ignorar erros de leitura inicial
    }
    initialized = true;
  },

  get<T>(key: string, defaultVal: T): T {
    const fullKey = 'omni.' + key;
    const raw = memCache[fullKey];
    if (raw == null) return defaultVal;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultVal;
    }
  },

  set(key: string, value: unknown): void {
    const fullKey = 'omni.' + key;
    try {
      const str = JSON.stringify(value);
      memCache[fullKey] = str;
      AsyncStorage.setItem(fullKey, str).catch(() => {});
    } catch {
      // Ignorar erros de serialização
    }
  },

  del(key: string): void {
    const fullKey = 'omni.' + key;
    delete memCache[fullKey];
    AsyncStorage.removeItem(fullKey).catch(() => {});
  }
};

