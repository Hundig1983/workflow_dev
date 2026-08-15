import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'familyhub.session.token';

/**
 * Article I.2 requires the session token to live in the platform secure store and
 * never in plain storage.
 *
 * The web target has no equivalent of Keychain/Keystore, and `localStorage` is exactly
 * the "plain storage" the article forbids. So on web the token is held in memory only:
 * it is lost on reload, which is worse ergonomics but strictly more conservative than
 * persisting a credential where any script can read it. Web is a development and
 * verification target here, not a shipping one — see README.
 */
let webMemoryToken: string | null = null;

const isWeb = Platform.OS === 'web';

export async function saveToken(token: string): Promise<void> {
  if (isWeb) {
    webMemoryToken = token;
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  if (isWeb) return webMemoryToken;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  if (isWeb) {
    webMemoryToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
