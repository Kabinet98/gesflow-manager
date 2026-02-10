import api from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSecureItem, getSecureItem, deleteSecureItem } from '@/utils/secure-storage';
import { User } from '@/types';
import { authEventEmitter } from '@/config/api';

export interface LoginCredentials {
  email: string;
  password: string;
  code?: string;
  securityAnswers?: Record<string, string>;
  mfaValidated?: boolean;
  securityAnswersValidated?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

class AuthService {
  private token: string | null = null;
  private user: User | null = null;
  private isInitialized = false;

  /**
   * Initialise le service en chargeant le token depuis SecureStore et l'ID utilisateur depuis AsyncStorage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Migrer depuis AsyncStorage si nécessaire (pour les utilisateurs existants)
      try {
        const oldToken = await AsyncStorage.getItem('auth_token');
        if (oldToken) {
          // Migrer vers SecureStore (ou AsyncStorage si SecureStore n'est pas disponible)
          await setSecureItem('auth_token', oldToken);
          await AsyncStorage.removeItem('auth_token');
          this.token = oldToken;
        }
      } catch (e) {
        // Erreur silencieuse lors de la migration
      }

      // Récupérer le token depuis SecureStore (ou AsyncStorage)
      try {
        const storedToken = await getSecureItem('auth_token');
        if (storedToken) {
          this.token = storedToken;
        }
      } catch (e) {
        // Erreur silencieuse
      }

      // Récupérer uniquement l'ID utilisateur depuis AsyncStorage
      try {
        const storedUserId = await AsyncStorage.getItem('user_id');
        if (storedUserId) {
          // L'utilisateur complet sera récupéré via l'API si nécessaire
          // On ne stocke que l'ID pour la sécurité
        }
      } catch (e) {
        // Erreur silencieuse
      }

      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = true;
    }
  }

  /**
   * Vérifie si l'utilisateur est un manager
   */
  isManager(user: User | null): boolean {
    if (!user || !user.role) {
      return false;
    }
    const roleName = user.role.name?.toLowerCase() || '';
    return roleName.includes('gestionnaire') || roleName.includes('manager');
  }

  /**
   * Décode une chaîne Base64 URL-safe en React Native
   * Utilise une méthode compatible avec React Native (sans Buffer)
   */
  private base64UrlDecode(str: string): string {
    // Remplacer les caractères URL-safe par les caractères Base64 standard
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    
    // Ajouter le padding si nécessaire
    while (base64.length % 4) {
      base64 += '=';
    }
    
    // Table de décodage Base64
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    
    base64 = base64.replace(/[^A-Za-z0-9\+\/\=]/g, '');
    
    while (i < base64.length) {
      const enc1 = chars.indexOf(base64.charAt(i++));
      const enc2 = chars.indexOf(base64.charAt(i++));
      const enc3 = chars.indexOf(base64.charAt(i++));
      const enc4 = chars.indexOf(base64.charAt(i++));
      
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      
      output += String.fromCharCode(chr1);
      
      if (enc3 !== 64) {
        output += String.fromCharCode(chr2);
      }
      if (enc4 !== 64) {
        output += String.fromCharCode(chr3);
      }
    }
    
    // Décoder les caractères UTF-8
    try {
      // Utiliser decodeURIComponent avec escape pour gérer les caractères UTF-8
      return decodeURIComponent(escape(output));
    } catch (e) {
      // Si decodeURIComponent échoue, retourner directement (pour les caractères ASCII)
      return output;
    }
  }

  /**
   * Décode un JWT et vérifie s'il est expiré
   * @param token Le token JWT à vérifier
   * @returns true si le token est expiré, false sinon
   */
  isTokenExpired(token: string): boolean {
    try {
      // Un JWT a 3 parties séparées par des points : header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Considérer comme expiré si le format est invalide
      }

      // Décoder le payload (partie 2)
      const payload = parts[1];
      
      // Base64 URL decode
      let decodedPayload: any;
      try {
        const decodedString = this.base64UrlDecode(payload);
        decodedPayload = JSON.parse(decodedString);
      } catch (decodeError: any) {
        return true; // Considérer comme expiré si on ne peut pas décoder
      }

      // Vérifier l'expiration (champ 'exp' en secondes Unix)
      if (!decodedPayload.exp) {
        return true;
      }

      const expirationTime = decodedPayload.exp * 1000; // Convertir en millisecondes
      const currentTime = Date.now();
      const isExpired = currentTime >= expirationTime;

      return isExpired;
    } catch (error: any) {
      return true; // En cas d'erreur, considérer comme expiré par sécurité
    }
  }

  /**
   * Connexion de l'utilisateur
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Appel API (l'intercepteur ne l'ajoutera pas pour /auth/)
      const response = await api.post('/api/auth/mobile-login', {
        email: credentials.email,
        password: credentials.password,
        code: credentials.code,
        securityAnswers: credentials.securityAnswers,
        mfaValidated: credentials.mfaValidated,
        securityAnswersValidated: credentials.securityAnswersValidated,
      });

      if (!response.data.success) {
        const errorMessage = response.data.error || 'Erreur de connexion';
        throw new Error(errorMessage);
      }

      const { token, user } = response.data;

      if (!token || !user) {
        throw new Error('Réponse de connexion invalide');
      }

      // La restriction "manager only" a été retirée - tous les utilisateurs peuvent se connecter

      // Nettoyer le token (enlever "Bearer " si présent)
      const cleanToken = token.startsWith('Bearer ') 
        ? token.replace(/^Bearer\s+/, '') 
        : token;
      
      // Vérifier que c'est un JWT valide
      const jwtParts = cleanToken.split('.');
      if (jwtParts.length !== 3) {
        throw new Error('Token invalide');
      }

      // Stocker le token de manière sécurisée (SecureStore avec fallback AsyncStorage)
      // Stocker uniquement l'ID utilisateur dans AsyncStorage (pas l'objet complet)
      await Promise.all([
        setSecureItem('auth_token', cleanToken),
        AsyncStorage.setItem('user_id', user.id),
      ]);

      // Mettre à jour l'état interne
      this.token = cleanToken;
      this.user = user;

      // Notifier les changements
      authEventEmitter.emit('auth-changed', true);
      authEventEmitter.emit('permissions-should-refresh', true);

      return { user, token: cleanToken };
    } catch (error: any) {
      const backendError = error.response?.data?.error;

      // RÈGLE CRITIQUE : Si error.response existe, c'est une erreur du backend
      // On doit TOUJOURS préserver error.response pour que LoginScreen puisse détecter
      // les erreurs de questions de sécurité AVANT de vérifier MANAGER_ONLY

      // Si c'est une erreur du backend (error.response existe), préserver la réponse
      if (error.response) {
        // Gérer les erreurs spécifiques et propager les données de la réponse
        if (backendError === 'CODE_REQUIRED') {
          const customError: any = new Error('CODE_REQUIRED');
          customError.response = error.response; // Préserver la réponse originale
          throw customError;
        }
        if (backendError === 'SECURITY_QUESTIONS_REQUIRED') {
          const customError: any = new Error('SECURITY_QUESTIONS_REQUIRED');
          customError.response = error.response; // Préserver la réponse originale avec les questions
          throw customError;
        }

        // Pour les erreurs de questions de sécurité (tentatives restantes, etc.),
        // propager l'erreur avec le message exact du backend
        if (
          backendError &&
          (backendError.includes('Tentatives restantes') ||
            backendError.includes('tentatives restantes') ||
            backendError.includes('Réponses incorrectes') ||
            backendError.includes('Compte désactivé') ||
            backendError.includes('compte désactivé'))
        ) {
          const customError: any = new Error(backendError);
          customError.response = error.response; // Préserver la réponse originale
          throw customError;
        }

        // Pour toutes les autres erreurs du backend, préserver error.response
        const customError: any = new Error(backendError || error.message || 'Erreur de connexion');
        customError.response = error.response; // PRÉSERVER la réponse originale
        throw customError;
      }

      // Si error.response n'existe pas, c'est une erreur côté client (comme MANAGER_ONLY)
      // Propager telle quelle
      throw error;
    }
  }

  /**
   * Réinitialise l'état interne (sans nettoyer le stockage)
   * Utilisé par l'intercepteur API quand le token est supprimé
   */
  resetInternalState(): void {
    this.token = null;
    this.user = null;
  }

  /**
   * Déconnexion de l'utilisateur
   */
  async logout(): Promise<void> {
    // Notifier le serveur de la déconnexion (le backend enregistre le log d'audit)
    try {
      const token = await getSecureItem('auth_token');
      if (token && !this.isTokenExpired(token)) {
        await api.post('/api/auth/logout', {}, { skipAuthError: true });
      }
    } catch (e) {
      // Erreur silencieuse - on continue la déconnexion locale même si l'API échoue
    }

    // Nettoyer le stockage sécurisé et AsyncStorage
    try {
      await Promise.all([
        deleteSecureItem('auth_token'),
        AsyncStorage.removeItem('user_id'),
        AsyncStorage.removeItem('user'), // Nettoyer l'ancien format si présent
        AsyncStorage.removeItem('last_login_time'),
      ]);
    } catch (e) {
      // Erreur silencieuse
    }

    // Réinitialiser l'état interne
    this.resetInternalState();

    // Notifier les changements
    authEventEmitter.emit('auth-changed', false);
  }

  /**
   * Récupère l'utilisateur actuel
   */
  async getCurrentUser(): Promise<User | null> {
    // S'assurer que le service est initialisé
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Si on a l'utilisateur en cache, le retourner
    if (this.user) {
      return this.user;
    }

    // Si pas d'utilisateur en cache, récupérer depuis l'API
    // On ne stocke plus l'objet utilisateur complet pour des raisons de sécurité
    try {
      // Vérifier d'abord si le token est expiré
      const currentToken = await this.getToken();
      if (currentToken && this.isTokenExpired(currentToken)) {
        await this.logout();
        return null;
      }

      const response = await api.get('/api/users/me');
      const user = response.data;
      
      // Stocker uniquement l'ID utilisateur (pas l'objet complet)
      await AsyncStorage.setItem('user_id', user.id);
      this.user = user;
      
      return user;
    } catch (error: any) {
      // Si erreur 401, vérifier si le token est expiré
      if (error.response?.status === 401) {
        const currentToken = await this.getToken();
        if (currentToken && this.isTokenExpired(currentToken)) {
          await this.logout();
          return null;
        }
        // Si le token n'est pas expiré, retourner l'utilisateur stocké
        return this.user || await this.getStoredUser();
      }

      return null;
    }
  }

  /**
   * Récupère l'utilisateur stocké (sans appel API)
   * Note: On ne stocke plus l'objet utilisateur complet, donc on retourne null
   * et l'utilisateur devra être récupéré via getCurrentUser() qui fait un appel API
   */
  async getStoredUser(): Promise<User | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Si on a l'utilisateur en cache, le retourner
    if (this.user) {
      return this.user;
    }

    // On ne stocke plus l'objet utilisateur complet pour des raisons de sécurité
    // Il faut utiliser getCurrentUser() qui fait un appel API
    return null;
  }

  /**
   * Vérifie si l'utilisateur est authentifié ET est un manager
   * Vérifie aussi l'expiration du token (définie côté backend, actuellement 30 jours)
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Toujours vérifier directement dans SecureStore (ou AsyncStorage) pour être sûr
    let storedToken: string | null = null;
    try {
      storedToken = await getSecureItem('auth_token');
    } catch (e) {
      // Erreur silencieuse
    }

    if (!storedToken) {
      // Si pas de token, réinitialiser l'état interne
      this.token = null;
      this.user = null;
      return false;
    }

    // Vérifier l'expiration du token (ex: 30 jours, défini côté backend)
    if (this.isTokenExpired(storedToken)) {
      await this.logout();
      return false;
    }

    // Mettre à jour l'état interne si nécessaire
    if (this.token !== storedToken) {
      this.token = storedToken;
    }

    // Si on n'a pas d'utilisateur en mémoire, tenter de le récupérer via l'API
    // Cela arrive après un redémarrage de l'app (this.user est null car en mémoire uniquement)
    if (!this.user) {
      try {
        const response = await api.get('/api/users/me', { skipAuthError: true });
        if (response.data) {
          this.user = response.data;
          await AsyncStorage.setItem('user_id', response.data.id);
        }
      } catch (e) {
        // Si l'API échoue mais que le token est valide, on considère quand même
        // l'utilisateur comme authentifié - les données user seront chargées plus tard
      }
    }

    return true;
  }

  /**
   * Récupère le token actuel
   */
  async getToken(): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.token) {
      return this.token;
    }

    try {
      const storedToken = await getSecureItem('auth_token');
      if (storedToken) {
        this.token = storedToken;
        return storedToken;
      }
    } catch (e) {
      // Erreur silencieuse
    }

    return null;
  }

  /**
   * Valide un code OTP
   */
  async validateOTP(code: string): Promise<boolean> {
    try {
      const response = await api.post('/api/auth/validate-otp', { code });
      return response.data.success === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Valide un code OTP pour déverrouiller
   */
  async validateOTPUnlock(code: string): Promise<boolean> {
    try {
      const response = await api.post('/api/auth/validate-otp-unlock', { code });
      return response.data.success === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Vérifie le statut MFA
   */
  async checkMFAStatus(): Promise<boolean> {
    try {
      const response = await api.get('/api/auth/2fa/status');
      return response.data.enabled === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Renouvelle le token d'authentification
   * Tente de renouveler le token en utilisant un endpoint de refresh ou en vérifiant la validité du token actuel
   * 
   * IMPORTANT: Cette fonction ne devrait être appelée que si on est sûr que le token est expiré.
   * Si le token est toujours valide mais que la requête échoue avec 401, c'est probablement
   * dû à une autre raison (rate limiting, permissions, etc.) et on ne devrait pas renouveler.
   */
  async refreshToken(): Promise<string | null> {
    try {
      // Récupérer le token actuel
      const currentToken = await this.getToken();
      if (!currentToken) {
        return null;
      }

      // Tenter d'utiliser un endpoint de refresh token si disponible
      try {
        const refreshResponse = await api.post('/api/auth/refresh', {}, {
          skipAuthError: true, // Ne pas déclencher de déconnexion si ça échoue
        });

        // Si le backend a un endpoint de refresh et qu'il retourne un nouveau token
        const newToken = refreshResponse.data?.token || refreshResponse.data?.accessToken;
        
        if (newToken) {
          // Nettoyer le token
          const cleanToken = newToken.startsWith('Bearer ') 
            ? newToken.replace(/^Bearer\s+/, '') 
            : newToken;
          
          // Stocker le nouveau token de manière sécurisée
          await setSecureItem('auth_token', cleanToken);
          this.token = cleanToken;
          
          return cleanToken;
        }
      } catch (refreshError: any) {
        // L'endpoint de refresh n'existe peut-être pas ou a échoué
        // Ce n'est pas grave, on continue avec la méthode suivante
      }

      // Si pas d'endpoint de refresh, tenter d'appeler /api/users/me pour vérifier si le token est toujours valide
      // Si la requête réussit, le token actuel est toujours valide
      try {
        const response = await api.get('/api/users/me', {
          skipAuthError: true, // Ne pas déclencher de déconnexion si ça échoue
        });

        // Vérifier s'il y a un nouveau token dans la réponse ou les headers
        const newToken = response.data?.token || 
                        response.headers?.['x-new-token'] || 
                        response.headers?.['authorization']?.replace('Bearer ', '') ||
                        response.headers?.['x-access-token'];
        
        if (newToken) {
          // Nettoyer le token
          const cleanToken = newToken.startsWith('Bearer ') 
            ? newToken.replace(/^Bearer\s+/, '') 
            : newToken;
          
          // Stocker le nouveau token de manière sécurisée
          await setSecureItem('auth_token', cleanToken);
          this.token = cleanToken;
          
          return cleanToken;
        }

        // Si pas de nouveau token mais que la requête réussit, le token actuel est toujours valide
        // Dans ce cas, on retourne null car le problème n'est pas l'expiration du token
        // mais probablement une autre raison (rate limiting, permissions, etc.)
        return null; // Retourner null pour éviter de réessayer avec le même token
      } catch (meError: any) {
        // Si /api/users/me échoue avec 401, le token est vraiment expiré
        // Dans ce cas, on ne peut pas renouveler sans les credentials
        return null;
      }
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Force la mise à jour de l'utilisateur depuis l'API
   */
  async refreshUser(): Promise<User | null> {
    try {
      // Vérifier d'abord si le token est expiré
      const currentToken = await this.getToken();
      if (currentToken && this.isTokenExpired(currentToken)) {
        await this.logout();
        return null;
      }

      const response = await api.get('/api/users/me');
      const user = response.data;
      
      // Stocker uniquement l'ID utilisateur (pas l'objet complet)
      await AsyncStorage.setItem('user_id', user.id);
      this.user = user;
      
      return user;
    } catch (error: any) {
      // Si erreur 401, vérifier si le token est expiré
      if (error.response?.status === 401) {
        const currentToken = await this.getToken();
        if (currentToken && this.isTokenExpired(currentToken)) {
          await this.logout();
          return null;
        }
        // Si le token n'est pas expiré, retourner l'utilisateur stocké
        return this.user || await this.getStoredUser();
      }

      return null;
    }
  }
}

// Créer une instance singleton
export const authService = new AuthService();

// Initialiser au démarrage
authService.initialize().catch(error => {
  // Erreur silencieuse
});
