import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registrarPush } from './dados';

/**
 * Pede permissão e registra o token Expo no servidor. O conteúdo do push é mínimo
 * (aparece na tela bloqueada): sem nomes nem valores.
 */
export async function registrarDispositivo(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return; // definido após `eas init`
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('padrao', { name: 'Avisos do condomínio', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registrarPush(data, Platform.OS);
}
