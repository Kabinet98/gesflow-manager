export function getErrorMessage(
  error: any,
  fallback = "Une erreur est survenue"
): string {
  // 1. Message backend (déjà en français pour les erreurs métier)
  const backendError = error?.response?.data?.error;
  if (typeof backendError === "string" && backendError.length > 0) {
    return humanize(backendError);
  }

  // 2. Erreur réseau / timeout (pas de response)
  if (!error?.response && typeof error?.message === "string") {
    return humanize(error.message);
  }

  // 3. Erreur HTTP sans message backend
  const status = error?.response?.status;
  if (status) {
    return httpStatusMessage(status) || fallback;
  }

  return fallback;
}

function humanize(msg: string): string {
  const lower = msg.toLowerCase();

  // Réseau
  if (lower.includes("network error"))
    return "Erreur de connexion. Vérifiez votre connexion internet.";
  if (lower.includes("econnrefused"))
    return "Impossible de joindre le serveur.";
  if (lower.includes("timeout"))
    return "Le serveur met trop de temps à répondre. Réessayez.";

  // Auth anglais du backend
  if (lower === "unauthorized")
    return "Session expirée. Veuillez vous reconnecter.";
  if (lower === "forbidden")
    return "Vous n'avez pas les permissions nécessaires.";
  if (lower === "not found" || lower.endsWith("not found"))
    return "Élément introuvable.";
  if (lower === "internal server error")
    return "Erreur interne du serveur. Réessayez plus tard.";
  if (lower.startsWith("request failed with status code"))
    return "Une erreur serveur est survenue.";

  // Sinon le message est déjà lisible (erreurs métier en français du backend)
  return msg;
}

function httpStatusMessage(status: number): string | null {
  switch (status) {
    case 401:
      return "Session expirée. Veuillez vous reconnecter.";
    case 403:
      return "Vous n'avez pas les permissions nécessaires.";
    case 404:
      return "Élément introuvable.";
    case 409:
      return "Cette opération est en conflit avec l'état actuel.";
    case 422:
      return "Les données envoyées sont invalides.";
    case 429:
      return "Trop de requêtes. Veuillez patienter.";
    case 500:
      return "Erreur interne du serveur. Réessayez plus tard.";
    case 502:
    case 503:
      return "Le serveur est temporairement indisponible.";
    default:
      return null;
  }
}
