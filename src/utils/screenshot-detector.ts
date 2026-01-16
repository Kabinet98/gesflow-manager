import { AppState, AppStateStatus, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import api from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

let lastLogTime = 0;
let appStateSubscription: any = null;
let screenshotListener: any = null;
let isProtectionActive = false;

let lastAppStateChangeTime = 0;
let appStateChangeCount = 0;

// Callback pour notifier quand un enregistrement vidéo est détecté
let videoRecordingCallback: ((isRecording: boolean) => void) | null = null;

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  const now = Date.now();
  
  if (nextAppState === 'active') {
    // Réactiver la protection quand l'app revient au premier plan
    // Cela garantit que la protection est toujours active même après un changement d'état
    await enableScreenshotPrevention();
    
    // Détecter les patterns suspects qui pourraient indiquer un enregistrement vidéo
    // Les enregistrements vidéo peuvent causer des changements d'état rapides
    if (now - lastAppStateChangeTime < 500 && appStateChangeCount > 0) {
      // Changements d'état très rapides - possible enregistrement vidéo
      await screenshotDetector.logCapture('app_state_rapid_change', {
        type: 'suspected_recording',
        changeCount: appStateChangeCount,
        timeSinceLastChange: now - lastAppStateChangeTime,
      });
      
      // Notifier le callback pour noircir l'écran
      if (videoRecordingCallback) {
        videoRecordingCallback(true);
        // Garder l'écran noir pendant au moins 2 secondes
        setTimeout(() => {
          if (videoRecordingCallback) {
            videoRecordingCallback(false);
          }
        }, 2000);
      }
      
      appStateChangeCount = 0;
    }
  } else if (nextAppState === 'background' || nextAppState === 'inactive') {
    // L'application passe en arrière-plan - possible capture d'écran ou enregistrement vidéo
    appStateChangeCount++;
    lastAppStateChangeTime = now;
    
    setTimeout(async () => {
      const currentState = AppState.currentState;
      if (currentState === 'active') {
        // L'application revient rapidement - possible capture d'écran ou enregistrement vidéo
        await screenshotDetector.logCapture('app_state_change', {
          type: 'suspected_capture',
        });
      }
    }, 100);
  }
};

export const screenshotDetector = {
  async init() {
    // Activer la prévention des captures d'écran et enregistrements vidéo
    await enableScreenshotPrevention();
    
    // Configurer le listener pour détecter les captures d'écran
    if (Platform.OS === 'ios') {
      // Sur iOS, on peut utiliser le listener pour détecter les captures
      try {
        screenshotListener = ScreenCapture.addScreenshotListener(() => {
          this.logCapture('screenshot_listener', {
            type: 'screenshot',
            platform: 'ios',
          });
        });
      } catch (error) {
        // Erreur silencieuse
      }
    }
    
    if (appStateSubscription) {
      appStateSubscription.remove();
    }
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  },

  // Enregistrer un callback pour être notifié des enregistrements vidéo
  onVideoRecordingDetected(callback: (isRecording: boolean) => void) {
    videoRecordingCallback = callback;
  },

  async logCapture(method: string, details?: any) {
    try {
      const now = Date.now();
      // Éviter les doublons (2 secondes de cooldown)
      if (now - lastLogTime < 2000) {
        return;
      }
      lastLogTime = now;

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user) return;

      const captureType = details?.type || 'unknown';
      const isVideoRecording = 
        captureType === 'video_recording' || 
        captureType === 'suspected_recording' ||
        method.includes('recording') ||
        method.includes('video');

      // Déterminer l'action et la description appropriées
      const action = isVideoRecording ? 'video_recording_detected' : 'screenshot_detected';
      const description = isVideoRecording 
        ? `Tentative d'enregistrement vidéo d'écran détectée via: ${method}`
        : `Capture d'écran détectée via: ${method}`;

      await api.post('/api/logs', {
        action,
        description,
        metadata: {
          method,
          platform: Platform.OS,
          type: captureType,
          timestamp: new Date().toISOString(),
          isVideoRecording,
          ...details,
        },
        isScreenshot: !isVideoRecording,
      });
    } catch (error) {
      // Erreur silencieuse
    }
  },

  // Alias pour compatibilité avec le code existant
  async logScreenshot(method: string, details?: any) {
    await this.logCapture(method, { ...details, type: 'screenshot' });
  },

  async destroy() {
    // Ne pas désactiver la prévention - elle doit rester active
    // await disableScreenshotPrevention();
    
    if (screenshotListener) {
      screenshotListener.remove();
      screenshotListener = null;
    }
    
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
  },
};

// Activer la prévention des captures d'écran ET des enregistrements vidéo
export const enableScreenshotPrevention = async () => {
  try {
    // preventScreenCaptureAsync() bloque à la fois :
    // - Les captures d'écran (screenshots)
    // - Les enregistrements vidéo d'écran (screen recording)
    // Sur iOS 11+ et Android (via FLAG_SECURE)
    await ScreenCapture.preventScreenCaptureAsync();
    isProtectionActive = true;
  } catch (error) {
    isProtectionActive = false;
  }
};

// Désactiver la prévention des captures d'écran (si nécessaire)
export const disableScreenshotPrevention = async () => {
  try {
    await ScreenCapture.allowScreenCaptureAsync();
    isProtectionActive = false;
  } catch (error) {
    // Erreur silencieuse
  }
};

// Vérifier si la protection est active
export const isProtectionEnabled = () => isProtectionActive;
