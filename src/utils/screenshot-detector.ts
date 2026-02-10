import { AppState, AppStateStatus, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { getSecureItem } from '@/utils/secure-storage';
import api from '@/config/api';
import { authService } from '@/services/auth.service';

let lastLogTime = 0;
const SCREENSHOT_COOLDOWN_MS = 5000; // 5s entre deux logs screenshot pour éviter doublons
let appStateSubscription: any = null;
let screenshotListener: any = null;
let isProtectionActive = false;

// Callback pour notifier quand un enregistrement vidéo est détecté
let videoRecordingCallback: ((isRecording: boolean) => void) | null = null;

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (nextAppState === 'active') {
    // Réactiver la protection quand l'app revient au premier plan
    await enableScreenshotPrevention();
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
      if (now - lastLogTime < SCREENSHOT_COOLDOWN_MS) {
        return;
      }
      lastLogTime = now;

      const token = await getSecureItem('auth_token');
      if (!token) return;

      const user = await authService.getCurrentUser();
      if (!user) return;

      const captureType = details?.type || 'unknown';
      const isVideoRecording =
        captureType === 'video_recording' ||
        captureType === 'suspected_recording' ||
        method.includes('recording') ||
        method.includes('video');

      // Ne logger comme screenshot que les vrais événements (listener iOS), pas les simples retours d'app
      const isRealScreenshot =
        (method === 'screenshot_listener' && captureType === 'screenshot') ||
        (captureType === 'screenshot' && method !== 'app_state_change_to_active');
      if (!isVideoRecording && !isRealScreenshot) {
        return;
      }

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