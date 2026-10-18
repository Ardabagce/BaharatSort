import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as Native from './native';

/** Expo Go'da native reklam modülü yoktur; orada oyun reklamsız çalışır. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Native modül yalnızca gerekirse yüklenir; Expo Go'da import edilmesi uygulamayı çökertir.
export const nativeAds = isExpoGo ? null : (require('./native') as typeof Native);
