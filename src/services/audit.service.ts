/**
 * Service d'audit côté mobile : envoie les actions utilisateur à l'API /api/logs.
 * Permet de tracer les vues d'écran et actions sans créer de faux positifs screenshot.
 */
import { Platform } from "react-native";
import api from "@/config/api";
import { getSecureItem } from "@/utils/secure-storage";

const SCREEN_VIEW_DEBOUNCE_MS = 60_000; // 1 min par écran avant de re-logger
const lastScreenViewTime: Record<string, number> = {};
let onLogSent: (() => void) | null = null;

/** Déduplication: éviter d'envoyer deux fois la même action (même action + resourceId) dans une fenêtre de 3 s */
const ACTION_DEDUPE_MS = 3_000;
let lastActionKey: string | null = null;
let lastActionTime = 0;

/**
 * Enregistre un callback appelé après chaque envoi de log réussi (ex: invalider la query "logs").
 * À appeler depuis la racine de l'app (ex: App.tsx) avec queryClient.invalidateQueries({ queryKey: ["logs"] }).
 */
export function setAuditLogsInvalidator(callback: () => void) {
  onLogSent = callback;
}

export const auditService = {
  /**
   * Envoyer une action d'audit (hors screenshot).
   */
  async logAction(
    action: string,
    options?: {
      resource?: string;
      resourceId?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    try {
      const token = await getSecureItem("auth_token");
      if (!token) return;

      // Éviter les doublons: même action + resourceId dans les dernières secondes = on n'envoie qu'une fois
      const dedupeKey = `${action}|${options?.resourceId ?? ""}`;
      const now = Date.now();
      if (dedupeKey === lastActionKey && now - lastActionTime < ACTION_DEDUPE_MS) {
        return;
      }
      lastActionKey = dedupeKey;
      lastActionTime = now;

      const body = {
        action,
        resource: options?.resource ?? null,
        resourceId: options?.resourceId ?? null,
        description: options?.description ?? null,
        metadata: options?.metadata
          ? { ...options.metadata, platform: "mobile", source: "gesflow-manager" }
          : { platform: "mobile", source: "gesflow-manager" },
        isScreenshot: false,
      };

      await api.post("/api/logs", body);
      onLogSent?.();
    } catch (err: any) {
      // Ne pas bloquer l'app si l'API échoue
      if (__DEV__) {
        const msg = err?.response?.data?.error ?? err?.message ?? String(err);
        const status = err?.response?.status;
        console.warn("[Audit] Échec envoi log:", action, "|", status, msg);
      }
    }
  },

  /**
   * Logger la consultation d'un écran (debounce pour éviter de surcharger les logs).
   */
  async logScreenView(screenName: string): Promise<void> {
    const now = Date.now();
    const last = lastScreenViewTime[screenName] ?? 0;
    if (now - last < SCREEN_VIEW_DEBOUNCE_MS) {
      return;
    }
    lastScreenViewTime[screenName] = now;

    await this.logAction("mobile_screen_view", {
      resource: "screen",
      resourceId: screenName,
      description: `Consultation écran: ${screenName}`,
      metadata: { screen: screenName, platform: Platform.OS },
    });
  },
};
