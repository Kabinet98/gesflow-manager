import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/contexts/ThemeContext";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  EyeIcon,
  ViewOffIcon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons";
import { InputOTP } from "@/components/ui/InputOTP";
import api from "@/config/api";
// Types axios sont automatiquement inclus via src/types/axios.d.ts

const emailPasswordSchema = z.object({
  email: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().email("Email invalide")),
  password: z.string().min(1, "Le mot de passe est requis"),
});

type EmailPasswordFormData = z.infer<typeof emailPasswordSchema>;

type AuthStep = "email" | "2fa" | "security" | "complete";
type ForgotPasswordStep = "email" | "otp" | "security" | "reset";

interface SecurityQuestion {
  id: string;
  question: string;
}

export function LoginScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<AuthStep>("email");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAccountDisabled, setIsAccountDisabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [securityQuestions, setSecurityQuestions] = useState<
    SecurityQuestion[]
  >([]);
  const [securityAnswers, setSecurityAnswers] = useState<
    Record<string, string>
  >({});
  const [showSecurityAnswers, setShowSecurityAnswers] = useState<
    Record<string, boolean>
  >({});

  // Stocker les credentials après validation de l'étape email/password
  const [storedCredentials, setStoredCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // États pour le flux de réinitialisation de mot de passe
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordStep, setForgotPasswordStep] =
    useState<ForgotPasswordStep>("email");
  const [forgotPasswordOtpCode, setForgotPasswordOtpCode] = useState("");
  const [forgotPasswordRequiresMFA, setForgotPasswordRequiresMFA] =
    useState(false);
  const [forgotPasswordRequiresSecurity, setForgotPasswordRequiresSecurity] =
    useState(false);
  const [forgotPasswordSecurityQuestions, setForgotPasswordSecurityQuestions] =
    useState<SecurityQuestion[]>([]);
  const [forgotPasswordSecurityAnswers, setForgotPasswordSecurityAnswers] =
    useState<Record<string, string>>({});
  const [
    forgotPasswordCurrentQuestionIndex,
    setForgotPasswordCurrentQuestionIndex,
  ] = useState(0);
  const [forgotPasswordCurrentAnswer, setForgotPasswordCurrentAnswer] =
    useState("");
  const [forgotPasswordShowAnswer, setForgotPasswordShowAnswer] =
    useState(false);
  const [forgotPasswordMfaValidated, setForgotPasswordMfaValidated] =
    useState(false);
  const [forgotPasswordSecurityValidated, setForgotPasswordSecurityValidated] =
    useState(false);
  const [forgotPasswordIsSubmitting, setForgotPasswordIsSubmitting] =
    useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    getValues,
    clearErrors,
  } = useForm<EmailPasswordFormData>({
    resolver: zodResolver(emailPasswordSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  // Étape 1 : Validation Email + Password
  const onSubmitEmailPassword = async (data: EmailPasswordFormData) => {
    setLoading(true);
    setAuthError(null);
    setIsAccountDisabled(false); // Réinitialiser l'état au début d'une nouvelle tentative

    try {
      // Appel initial avec seulement email et password
      const response = await authService.login({
        email: data.email,
        password: data.password,
      });

      // Si succès, connexion complète (pas de 2FA ni questions)
      setAuthError(null);
    } catch (error: any) {
      // TOUJOURS utiliser le message du backend en priorité
      const backendError = error.response?.data?.error;
      const errorMessage =
        backendError || error.message || "Erreur de connexion";

      if (
        errorMessage === "CODE_REQUIRED" ||
        backendError === "CODE_REQUIRED"
      ) {
        // Passer à l'étape 2FA
        setStoredCredentials({ email: data.email, password: data.password });
        setStep("2fa");
        setAuthError(null);
        setOtpCode("");
      } else if (
        errorMessage === "SECURITY_QUESTIONS_REQUIRED" ||
        backendError === "SECURITY_QUESTIONS_REQUIRED"
      ) {
        // Passer directement aux questions de sécurité (pas de 2FA)
        setStoredCredentials({ email: data.email, password: data.password });
        setIsAccountDisabled(false); // Réinitialiser l'état au début d'une nouvelle tentative

        // D'abord essayer de récupérer depuis la réponse d'erreur
        const rawQuestions =
          error.response?.data?.questions ||
          error.response?.data?.securityQuestions ||
          [];

        let questions: SecurityQuestion[] = [];

        if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
          // Questions dans la réponse
          questions = rawQuestions.map((q: any, index: number) => ({
            id: q.id || q.questionId || `q${index}`,
            question: q.question || q.text || String(q),
          }));
        } else {
          // Récupérer les questions via un appel API
          setLoading(true);
          questions = await fetchSecurityQuestions(data.email);
          setLoading(false);
        }

        if (questions.length === 0) {
          setAuthError(
            "Erreur: Aucune question de sécurité trouvée. Veuillez contacter l'administrateur.",
          );
        } else {
          setSecurityQuestions(questions);
          setStep("security");
          setAuthError(null);
        }
      } else if (
        errorMessage.includes("Network") ||
        errorMessage.includes("network") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Impossible de se connecter")
      ) {
        // Pour les erreurs réseau, utiliser le message exact
        const networkMessage = backendError || errorMessage;
        setAuthError(networkMessage);
        Alert.alert("Erreur de connexion", networkMessage);
      } else {
        // TOUJOURS utiliser le message du backend en priorité
        const finalMessage = backendError || errorMessage;
        const errorLower = finalMessage.toLowerCase();
        const statusCode = error.response?.status;

        // Vérifier si le compte est désactivé (priorité haute)
        const isAccountDisabledError =
          errorLower.includes("désactivé") ||
          errorLower.includes("desactivé") ||
          errorLower.includes("disabled") ||
          errorLower.includes("bloqué") ||
          errorLower.includes("blocked") ||
          statusCode === 403; // 403 Forbidden peut indiquer un compte désactivé

        if (isAccountDisabledError) {
          setIsAccountDisabled(true);
          // Utiliser le message du backend (déjà dans finalMessage)
          setAuthError(finalMessage);
        } else {
          setIsAccountDisabled(false);
          // TOUJOURS afficher le message du backend, pas de message générique
          setAuthError(finalMessage);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Étape 2 : Validation Code 2FA
  const onSubmit2FA = async () => {
    if (!storedCredentials) {
      setAuthError("Erreur: credentials manquants");
      return;
    }

    if (otpCode.length !== 6) {
      setAuthError("Veuillez entrer un code à 6 chiffres");
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      // Ne JAMAIS mettre mfaValidated: true - le backend DOIT valider le code avec speakeasy
      // Le backend utilise speakeasy.totp.verify avec window: 2 pour valider les codes
      // Cela garantit que seuls les codes valides (dans la fenêtre de ±2 périodes) sont acceptés
      const response = await authService.login({
        email: storedCredentials.email,
        password: storedCredentials.password,
        code: otpCode,
        // mfaValidated est undefined/false - le backend validera le code
      });

      // Si succès, connexion complète
      setAuthError(null);
    } catch (error: any) {
      // TOUJOURS utiliser le message du backend en priorité
      const backendError = error.response?.data?.error;
      const errorMessage =
        backendError || error.message || "Erreur de connexion";

      if (
        errorMessage === "SECURITY_QUESTIONS_REQUIRED" ||
        backendError === "SECURITY_QUESTIONS_REQUIRED"
      ) {
        // Passer aux questions de sécurité
        // D'abord essayer de récupérer depuis la réponse d'erreur
        const rawQuestions =
          error.response?.data?.questions ||
          error.response?.data?.securityQuestions ||
          [];

        let questions: SecurityQuestion[] = [];

        if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
          // Questions dans la réponse
          questions = rawQuestions.map((q: any, index: number) => ({
            id: q.id || q.questionId || `q${index}`,
            question: q.question || q.text || String(q),
          }));
        } else {
          // Récupérer les questions via un appel API
          if (storedCredentials) {
            questions = await fetchSecurityQuestions(storedCredentials.email);
          }
        }

        if (questions.length === 0) {
          setAuthError(
            "Erreur: Aucune question de sécurité trouvée. Veuillez contacter l'administrateur.",
          );
        } else {
          setSecurityQuestions(questions);
          setStep("security");
          setAuthError(null);
        }
      } else {
        // TOUJOURS afficher le message exact du backend
        const finalMessage = backendError || errorMessage;
        setAuthError(finalMessage);
        setOtpCode("");
      }
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour récupérer les questions de sécurité (comme dans GesFlow)
  const fetchSecurityQuestions = async (
    email: string,
  ): Promise<SecurityQuestion[]> => {
    try {
      // Utiliser l'endpoint POST /api/auth/security-questions comme dans GesFlow
      const response = await api.post(
        "/api/auth/security-questions",
        { email, count: 2 }, // count: 2 pour récupérer 2 questions (comme dans GesFlow)
        { skipAuthError: true },
      );

      const rawQuestions = response.data?.questions || [];

      // Normaliser le format des questions
      return Array.isArray(rawQuestions)
        ? rawQuestions.map((q: any) => ({
            id: q.id || q.questionId,
            question: q.question || q.text || String(q),
          }))
        : [];
    } catch (error: any) {
      return [];
    }
  };

  // Étape 3 : Validation Questions de Sécurité
  const onSubmitSecurityQuestions = async () => {
    if (isAccountDisabled) {
      // Ne pas permettre de nouvelles tentatives si le compte est désactivé
      return;
    }

    if (!storedCredentials) {
      setAuthError("Erreur: credentials manquants");
      return;
    }

    // Vérifier que toutes les questions ont une réponse
    const allAnswered = securityQuestions.every(
      (q) => securityAnswers[q.id] && securityAnswers[q.id].trim() !== "",
    );

    if (!allAnswered) {
      setAuthError("Veuillez répondre à toutes les questions de sécurité");
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      // IMPORTANT : Ne JAMAIS mettre securityAnswersValidated: true
      // Le backend DOIT valider les réponses aux questions de sécurité
      // Si on met securityAnswersValidated: true, le backend saute la validation
      // et génère un token même si les réponses sont incorrectes

      // Normaliser les réponses pour qu'elles ne soient pas sensibles à la casse
      // Convertir toutes les réponses en minuscules et trim
      const normalizedAnswers: Record<string, string> = {};
      Object.keys(securityAnswers).forEach((questionId) => {
        normalizedAnswers[questionId] = securityAnswers[questionId]
          .trim()
          .toLowerCase();
      });

      const response = await authService.login({
        email: storedCredentials.email,
        password: storedCredentials.password,
        code: otpCode || undefined,
        securityAnswers: normalizedAnswers,
        // securityAnswersValidated sera false/undefined - le backend validera les réponses
      });

      // Si succès, connexion complète
      setAuthError(null);
    } catch (error: any) {
      // RÈGLE ABSOLUE : Si error.response existe, c'est une erreur du backend
      // Les erreurs du backend (questions incorrectes) ont la priorité

      const backendError = error.response?.data?.error;
      const errorMessage = error.message;
      const hasBackendResponse = !!error.response;

      // PRIORITÉ ABSOLUE 1 : Si error.response existe, c'est une erreur du backend
      // Vérifier d'abord les erreurs de questions de sécurité
      if (hasBackendResponse && backendError) {
        // Vérifier si c'est une erreur de questions de sécurité
        const isSecurityQuestionError =
          backendError.includes("Tentatives restantes") ||
          backendError.includes("tentatives restantes") ||
          backendError.includes("Réponses incorrectes") ||
          backendError.includes("Compte désactivé") ||
          backendError.includes("compte désactivé") ||
          backendError.includes("Aucune réponse fournie") ||
          backendError.includes("Aucune question de sécurité");

        if (isSecurityQuestionError) {
          // Vérifier si le compte est désactivé
          const isDisabled =
            backendError.includes("Compte désactivé") ||
            backendError.includes("compte désactivé") ||
            backendError.toLowerCase().includes("account disabled") ||
            backendError.toLowerCase().includes("compte bloqué");

          if (isDisabled) {
            setIsAccountDisabled(true);
            setAuthError(
              "Votre compte a été désactivé en raison de tentatives de connexion échouées.\n\n" +
                "Veuillez contacter l'administrateur pour réactiver votre compte.",
            );
          } else {
            setIsAccountDisabled(false);
            setAuthError(backendError);
          }
          // Ne pas réinitialiser les réponses pour permettre à l'utilisateur de corriger (sauf si désactivé)
          if (isDisabled) {
            setSecurityAnswers({});
          }
          return;
        }
      }

      // PRIORITÉ 2 : Vérifier aussi dans errorMessage si c'est une erreur transformée par authService
      // (mais seulement si error.response existe, pour être sûr que c'est une erreur backend)
      if (hasBackendResponse && errorMessage) {
        const isSecurityQuestionErrorInMessage =
          errorMessage.includes("Tentatives restantes") ||
          errorMessage.includes("tentatives restantes") ||
          errorMessage.includes("Réponses incorrectes") ||
          errorMessage.includes("Compte désactivé") ||
          errorMessage.includes("compte désactivé");

        if (isSecurityQuestionErrorInMessage) {
          // Vérifier si le compte est désactivé
          const isDisabled =
            errorMessage.includes("Compte désactivé") ||
            errorMessage.includes("compte désactivé") ||
            errorMessage.toLowerCase().includes("account disabled") ||
            errorMessage.toLowerCase().includes("compte bloqué");

          if (isDisabled) {
            setIsAccountDisabled(true);
            setAuthError(
              "Votre compte a été désactivé en raison de tentatives de connexion échouées.\n\n" +
                "Veuillez contacter l'administrateur pour réactiver votre compte.",
            );
          } else {
            setIsAccountDisabled(false);
            setAuthError(errorMessage);
          }
          if (isDisabled) {
            setSecurityAnswers({});
          }
          return;
        }
      }

      // PRIORITÉ 3 : Autres erreurs - TOUJOURS utiliser le message du backend en priorité
      // Si aucun message n'est disponible, utiliser error.message qui peut contenir des infos utiles
      const finalError =
        backendError ||
        errorMessage ||
        error.message ||
        "Une erreur est survenue lors de la connexion. Veuillez réessayer.";
      setAuthError(finalError);
    } finally {
      setLoading(false);
    }
  };

  // Retour à l'étape précédente
  const handleGoBack = () => {
    if (isAccountDisabled) {
      // Si le compte est désactivé, ne pas permettre de retour
      return;
    }
    if (step === "2fa") {
      setStep("email");
      setOtpCode("");
      setAuthError(null);
      setIsAccountDisabled(false);
    } else if (step === "security") {
      if (otpCode) {
        // Si on avait un code 2FA, retourner à l'étape 2FA
        setStep("2fa" as any);
      } else {
        // Sinon retourner à l'étape email
        setStep("email");
      }
      setSecurityAnswers({});
      setAuthError(null);
      setIsAccountDisabled(false);
    }
  };

  // Fonctions pour le flux de réinitialisation de mot de passe
  const handleForgotPasswordInit = async (email: string) => {
    setForgotPasswordIsSubmitting(true);
    setAuthError(null);

    try {
      const response = await api.post(
        "/api/auth/forgot-password/init",
        { email },
        { skipAuthError: true },
      );

      const responseData = response.data;

      if (responseData.success) {
        setForgotPasswordEmail(email);
        setForgotPasswordRequiresMFA(responseData.requiresMFA);
        setForgotPasswordRequiresSecurity(
          responseData.requiresSecurityQuestions,
        );

        if (responseData.securityQuestions) {
          setForgotPasswordSecurityQuestions(
            responseData.securityQuestions.map((q: any) => ({
              id: q.id,
              question: q.question,
            })),
          );
        }

        if (responseData.requiresMFA) {
          setForgotPasswordStep("otp");
        } else if (responseData.requiresSecurityQuestions) {
          setForgotPasswordStep("security");
          setForgotPasswordCurrentQuestionIndex(0);
          setForgotPasswordCurrentAnswer("");
          setForgotPasswordSecurityAnswers({});
        } else {
          setForgotPasswordStep("reset");
        }
      } else {
        setAuthError(responseData.message || "Une erreur est survenue");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Une erreur est survenue";
      setAuthError(errorMessage);
    } finally {
      setForgotPasswordIsSubmitting(false);
    }
  };

  const handleForgotPasswordValidateOTP = async () => {
    if (forgotPasswordOtpCode.length !== 6) {
      setAuthError("Veuillez entrer un code à 6 chiffres");
      return;
    }

    setForgotPasswordIsSubmitting(true);
    setAuthError(null);

    try {
      const response = await api.post(
        "/api/auth/forgot-password/validate-otp",
        {
          email: forgotPasswordEmail,
          code: forgotPasswordOtpCode,
        },
        { skipAuthError: true },
      );

      if (response.data.valid) {
        setForgotPasswordMfaValidated(true);
        if (forgotPasswordRequiresSecurity) {
          setForgotPasswordStep("security");
          setForgotPasswordCurrentQuestionIndex(0);
          setForgotPasswordCurrentAnswer("");
          setForgotPasswordSecurityAnswers({});
        } else {
          setForgotPasswordStep("reset");
        }
      } else {
        setAuthError(response.data.error || "Code invalide");
        setForgotPasswordOtpCode("");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Code d'authentification invalide";
      setAuthError(errorMessage);
      setForgotPasswordOtpCode("");
    } finally {
      setForgotPasswordIsSubmitting(false);
    }
  };

  const handleForgotPasswordValidateSecurity = async () => {
    if (!forgotPasswordCurrentAnswer.trim()) {
      setAuthError("Veuillez répondre à la question");
      return;
    }

    setForgotPasswordIsSubmitting(true);
    setAuthError(null);

    try {
      const currentQuestion =
        forgotPasswordSecurityQuestions[forgotPasswordCurrentQuestionIndex];
      const allAnswers = {
        ...forgotPasswordSecurityAnswers,
        [currentQuestion.id]: forgotPasswordCurrentAnswer.trim().toLowerCase(),
      };

      if (
        forgotPasswordCurrentQuestionIndex <
        forgotPasswordSecurityQuestions.length - 1
      ) {
        // Passer à la question suivante
        setForgotPasswordSecurityAnswers(allAnswers);
        setForgotPasswordCurrentQuestionIndex(
          forgotPasswordCurrentQuestionIndex + 1,
        );
        setForgotPasswordCurrentAnswer(
          forgotPasswordSecurityAnswers[
            forgotPasswordSecurityQuestions[
              forgotPasswordCurrentQuestionIndex + 1
            ].id
          ] || "",
        );
        setForgotPasswordShowAnswer(false);
      } else {
        // Dernière question, valider toutes les réponses
        const response = await api.post(
          "/api/auth/forgot-password/validate-security",
          {
            email: forgotPasswordEmail,
            answers: allAnswers,
          },
          { skipAuthError: true },
        );

        if (response.data.valid) {
          setForgotPasswordSecurityValidated(true);
          setForgotPasswordStep("reset");
        } else {
          setAuthError(response.data.error || "Réponses incorrectes");
          setForgotPasswordSecurityAnswers({});
          setForgotPasswordCurrentAnswer("");
          setForgotPasswordCurrentQuestionIndex(0);
        }
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Une erreur est survenue";
      setAuthError(errorMessage);
      setForgotPasswordSecurityAnswers({});
      setForgotPasswordCurrentAnswer("");
      setForgotPasswordCurrentQuestionIndex(0);
    } finally {
      setForgotPasswordIsSubmitting(false);
    }
  };

  const handleForgotPasswordReset = async () => {
    if (!newPassword || !confirmPassword) {
      setAuthError("Veuillez remplir tous les champs");
      return;
    }

    if (newPassword !== confirmPassword) {
      setAuthError("Les mots de passe ne correspondent pas");
      return;
    }

    if (newPassword.length < 8) {
      setAuthError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setForgotPasswordIsSubmitting(true);
    setAuthError(null);

    try {
      const response = await api.post(
        "/api/auth/forgot-password/reset",
        {
          email: forgotPasswordEmail,
          newPassword,
          confirmPassword,
        },
        { skipAuthError: true },
      );

      if (response.data.success) {
        Alert.alert(
          "Succès",
          "Mot de passe modifié avec succès. Vous pouvez maintenant vous connecter.",
          [
            {
              text: "OK",
              onPress: () => {
                // Réinitialiser tous les états
                setShowForgotPassword(false);
                setForgotPasswordStep("email");
                setForgotPasswordEmail("");
                setForgotPasswordOtpCode("");
                setForgotPasswordRequiresMFA(false);
                setForgotPasswordRequiresSecurity(false);
                setForgotPasswordSecurityQuestions([]);
                setForgotPasswordSecurityAnswers({});
                setForgotPasswordCurrentQuestionIndex(0);
                setForgotPasswordCurrentAnswer("");
                setForgotPasswordMfaValidated(false);
                setForgotPasswordSecurityValidated(false);
                setNewPassword("");
                setConfirmPassword("");
                setAuthError(null);
              },
            },
          ],
        );
      } else {
        setAuthError(response.data.error || "Une erreur est survenue");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Une erreur est survenue lors de la modification du mot de passe";
      setAuthError(errorMessage);
    } finally {
      setForgotPasswordIsSubmitting(false);
    }
  };

  // Rendu de l'étape Email/Password
  const renderEmailPasswordStep = () => (
    <>
      <Animated.View
        entering={FadeInDown.delay(300).duration(600)}
        style={{ marginBottom: 20 }}
      >
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500", marginBottom: 8 }}>
                Email <Text style={{ color: "#f87171" }}>*</Text>
              </Text>
              <TextInput
                value={value}
                onChangeText={(text) => {
                  onChange(text);
                  if (authError) setAuthError(null);
                  if (errors.email) clearErrors("email");
                  // Réinitialiser l'état de compte désactivé si l'utilisateur modifie le champ
                  if (isAccountDisabled) {
                    setIsAccountDisabled(false);
                  }
                }}
                onBlur={onBlur}
                placeholder="Email"
                placeholderTextColor="#6b7280"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                style={{
                  height: 56,
                  paddingHorizontal: 20,
                  borderRadius: 16,
                  fontSize: 16,
                  color: "#ffffff",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  borderWidth: 1,
                  borderColor: errors.email
                    ? "rgba(239, 68, 68, 0.5)"
                    : "rgba(255, 255, 255, 0.15)",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              />
              {errors.email && (
                <Text className="text-red-400 text-sm mt-2 ml-1 font-medium">
                  {errors.email.message}
                </Text>
              )}
            </View>
          )}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(400).duration(600)}
        style={{ marginBottom: 20 }}
      >
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500", marginBottom: 8 }}>
                Mot de passe <Text style={{ color: "#f87171" }}>*</Text>
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  value={value}
                  onChangeText={(text) => {
                    onChange(text);
                    if (authError) setAuthError(null);
                    // Réinitialiser l'état de compte désactivé si l'utilisateur modifie le champ
                    if (isAccountDisabled) {
                      setIsAccountDisabled(false);
                    }
                  }}
                  onBlur={onBlur}
                  placeholder="Mot de passe"
                  placeholderTextColor="#6b7280"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  style={{
                    height: 56,
                    paddingHorizontal: 20,
                    paddingRight: 60,
                    borderRadius: 16,
                    fontSize: 16,
                    color: "#ffffff",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderColor: errors.password
                      ? "rgba(239, 68, 68, 0.5)"
                      : "rgba(255, 255, 255, 0.15)",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 4,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 16,
                    top: 0,
                    bottom: 0,
                    justifyContent: "center",
                    alignItems: "center",
                    width: 40,
                    height: 56,
                  }}
                  activeOpacity={0.7}
                >
                  <HugeiconsIcon
                    icon={showPassword ? ViewOffIcon : EyeIcon}
                    size={24}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text className="text-red-400 text-sm mt-2 ml-1 font-medium">
                  {errors.password.message}
                </Text>
              )}
            </View>
          )}
        />
      </Animated.View>

      {/* Bouton Mot de passe oublié */}
      <Animated.View
        entering={FadeInDown.delay(450).duration(600)}
        style={{ marginBottom: 20, alignItems: "flex-end" }}
      >
        <TouchableOpacity
          onPress={() => setShowForgotPassword(true)}
          activeOpacity={0.7}
        >
          <Text className="text-sm text-primary-dynamic underline">
            Mot de passe oublié ?
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );

  // Rendu de l'étape 2FA
  const render2FAStep = () => (
    <>
      <Animated.View
        entering={FadeInDown.delay(300).duration(600)}
        style={{ marginBottom: 20 }}
      >
        <Text className="text-base font-semibold text-gray-300 mb-2 text-center">
          Code d'authentification à deux facteurs
        </Text>
        <Text className="text-sm text-gray-400 mb-2 text-center">
          Code <Text style={{ color: "#f87171" }}>*</Text>
        </Text>
        <Text className="text-sm text-gray-400 mb-6 text-center">
          Entrez le code à 6 chiffres généré par votre application
          d'authentification
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(400).duration(600)}
        style={{ marginBottom: 20 }}
      >
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            paddingHorizontal: 0,
          }}
        >
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={(value) => {
              setOtpCode(value);
              // Réinitialiser l'état de compte désactivé si l'utilisateur modifie le code
              if (isAccountDisabled) {
                setIsAccountDisabled(false);
              }
              if (authError) setAuthError(null);
            }}
            autoFocus={true}
            disabled={isAccountDisabled}
          />
        </View>
      </Animated.View>
    </>
  );

  // Rendu de l'étape Questions de Sécurité
  const renderSecurityQuestionsStep = () => {
    if (securityQuestions.length === 0) {
      return (
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{ marginBottom: 24 }}
        >
          <Text className="text-base font-semibold text-gray-300 mb-2 text-center">
            Questions de sécurité
          </Text>
          <Text className="text-sm text-red-400 mb-6 text-center">
            Aucune question de sécurité disponible. Veuillez réessayer.
          </Text>
        </Animated.View>
      );
    }

    return (
      <>
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{ marginBottom: 24 }}
        >
          <Text className="text-base font-semibold text-gray-300 mb-2 text-center">
            Questions de sécurité
          </Text>
          <Text className="text-sm text-gray-400 mb-6 text-center">
            Veuillez répondre aux questions suivantes
          </Text>
          {securityQuestions.map((question, index) => (
            <View key={question.id} style={{ marginBottom: 20 }}>
              <Text className="text-sm font-medium text-gray-300 mb-2">
                {index + 1}. {question.question} <Text className="text-red-500">*</Text>
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  value={securityAnswers[question.id] || ""}
                  onChangeText={(text) => {
                    setSecurityAnswers({
                      ...securityAnswers,
                      [question.id]: text,
                    });
                    if (authError) setAuthError(null);
                    // Réinitialiser l'état de compte désactivé si l'utilisateur modifie le champ
                    if (isAccountDisabled) {
                      setIsAccountDisabled(false);
                    }
                  }}
                  placeholder="Votre réponse"
                  placeholderTextColor="#6b7280"
                  secureTextEntry={!showSecurityAnswers[question.id]}
                  style={{
                    height: 56,
                    paddingHorizontal: 20,
                    paddingRight: 60, // Espace pour le bouton eye
                    borderRadius: 16,
                    fontSize: 16,
                    color: "#ffffff",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.15)",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 4,
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowSecurityAnswers({
                      ...showSecurityAnswers,
                      [question.id]: !showSecurityAnswers[question.id],
                    });
                  }}
                  style={{
                    position: "absolute",
                    right: 16,
                    top: 0,
                    bottom: 0,
                    justifyContent: "center",
                    alignItems: "center",
                    width: 40,
                    height: 56,
                  }}
                  activeOpacity={0.7}
                >
                  <HugeiconsIcon
                    icon={
                      showSecurityAnswers[question.id] ? ViewOffIcon : EyeIcon
                    }
                    size={24}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Animated.View>
      </>
    );
  };

  const getStepTitle = () => {
    if (showForgotPassword) {
      switch (forgotPasswordStep) {
        case "email":
          return "Réinitialisation du mot de passe";
        case "otp":
          return "Code d'authentification";
        case "security":
          return "Questions de sécurité";
        case "reset":
          return "Nouveau mot de passe";
        default:
          return "Réinitialisation du mot de passe";
      }
    }
    switch (step) {
      case "email":
        return "Connectez-vous à votre compte";
      case "2fa":
        return "Authentification à deux facteurs";
      case "security":
        return "Questions de sécurité";
      default:
        return "Connectez-vous à votre compte";
    }
  };

  const getStepButtonText = () => {
    if (showForgotPassword) {
      switch (forgotPasswordStep) {
        case "email":
          return forgotPasswordIsSubmitting ? "Vérification..." : "Continuer";
        case "otp":
          return forgotPasswordIsSubmitting ? "Vérification..." : "Vérifier";
        case "security":
          return forgotPasswordIsSubmitting
            ? "Vérification..."
            : forgotPasswordCurrentQuestionIndex <
                forgotPasswordSecurityQuestions.length - 1
              ? "Suivant"
              : "Vérifier";
        case "reset":
          return forgotPasswordIsSubmitting
            ? "Modification..."
            : "Modifier le mot de passe";
        default:
          return "Continuer";
      }
    }
    switch (step) {
      case "email":
        return loading ? "Connexion..." : "Se connecter";
      case "2fa":
        return loading ? "Vérification..." : "Vérifier";
      case "security":
        return loading ? "Vérification..." : "Vérifier";
      default:
        return "Se connecter";
    }
  };

  const handleStepSubmit = () => {
    if (showForgotPassword) {
      switch (forgotPasswordStep) {
        case "email":
          if (forgotPasswordEmail.trim()) {
            handleForgotPasswordInit(forgotPasswordEmail.trim());
          }
          break;
        case "otp":
          handleForgotPasswordValidateOTP();
          break;
        case "security":
          handleForgotPasswordValidateSecurity();
          break;
        case "reset":
          handleForgotPasswordReset();
          break;
      }
    } else {
      switch (step) {
        case "email":
          handleSubmit(onSubmitEmailPassword)();
          break;
        case "2fa":
          onSubmit2FA();
          break;
        case "security":
          onSubmitSecurityQuestions();
          break;
      }
    }
  };

  // Rendu pour le flux de réinitialisation de mot de passe
  const renderForgotPasswordEmailStep = () => (
    <>
      <Animated.View
        entering={FadeInDown.delay(300).duration(600)}
        style={{ marginBottom: 20 }}
      >
        <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500", marginBottom: 8 }}>
          Email <Text style={{ color: "#f87171" }}>*</Text>
        </Text>
        <TextInput
          value={forgotPasswordEmail}
          onChangeText={(text) => {
            setForgotPasswordEmail(text);
            if (authError) setAuthError(null);
          }}
          placeholder="Email"
          placeholderTextColor="#6b7280"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          style={{
            height: 56,
            paddingHorizontal: 20,
            borderRadius: 16,
            fontSize: 16,
            color: "#ffffff",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderWidth: 1,
            borderColor: authError
              ? "rgba(239, 68, 68, 0.5)"
              : "rgba(255, 255, 255, 0.15)",
          }}
        />
      </Animated.View>
    </>
  );

  const renderForgotPasswordOTPStep = () => (
    <>
      <Animated.View
        entering={FadeInDown.delay(300).duration(600)}
        style={{ marginBottom: 20 }}
      >
        <Text className="text-base font-semibold text-gray-300 mb-2 text-center">
          Code d'authentification à deux facteurs
        </Text>
        <Text className="text-sm text-gray-400 mb-2 text-center">
          Code <Text style={{ color: "#f87171" }}>*</Text>
        </Text>
        <Text className="text-sm text-gray-400 mb-6 text-center">
          Entrez le code à 6 chiffres généré par votre application
          d'authentification
        </Text>
      </Animated.View>
      <Animated.View
        entering={FadeInDown.delay(400).duration(600)}
        style={{ marginBottom: 20 }}
      >
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <InputOTP
            maxLength={6}
            value={forgotPasswordOtpCode}
            onChange={(value) => {
              setForgotPasswordOtpCode(value);
              if (authError) setAuthError(null);
            }}
            autoFocus={true}
            disabled={forgotPasswordIsSubmitting}
          />
        </View>
      </Animated.View>
    </>
  );

  const renderForgotPasswordSecurityStep = () => {
    if (forgotPasswordSecurityQuestions.length === 0) {
      return (
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{ marginBottom: 24 }}
        >
          <Text className="text-base font-semibold text-gray-300 mb-2 text-center">
            Questions de sécurité
          </Text>
          <Text className="text-sm text-red-400 mb-6 text-center">
            Aucune question de sécurité disponible.
          </Text>
        </Animated.View>
      );
    }

    const currentQuestion =
      forgotPasswordSecurityQuestions[forgotPasswordCurrentQuestionIndex];

    return (
      <>
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{ marginBottom: 24 }}
        >
          <Text className="text-base font-semibold text-gray-300 mb-2 text-center">
            Questions de sécurité
          </Text>
          <Text className="text-sm text-gray-400 mb-4 text-center">
            Question {forgotPasswordCurrentQuestionIndex + 1} sur{" "}
            {forgotPasswordSecurityQuestions.length}
          </Text>
          <Text className="text-sm font-medium text-gray-300 mb-4">
            {currentQuestion.question} <Text className="text-red-500">*</Text>
          </Text>
          <View style={{ position: "relative" }}>
            <TextInput
              value={forgotPasswordCurrentAnswer}
              onChangeText={(text) => {
                setForgotPasswordCurrentAnswer(text);
                if (authError) setAuthError(null);
              }}
              placeholder="Votre réponse"
              placeholderTextColor="#6b7280"
              secureTextEntry={!forgotPasswordShowAnswer}
              style={{
                height: 56,
                paddingHorizontal: 20,
                paddingRight: 60,
                borderRadius: 16,
                fontSize: 16,
                color: "#ffffff",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            />
            <TouchableOpacity
              onPress={() =>
                setForgotPasswordShowAnswer(!forgotPasswordShowAnswer)
              }
              style={{
                position: "absolute",
                right: 16,
                top: 0,
                bottom: 0,
                justifyContent: "center",
                alignItems: "center",
                width: 40,
                height: 56,
              }}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={forgotPasswordShowAnswer ? ViewOffIcon : EyeIcon}
                size={24}
                color="#9ca3af"
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </>
    );
  };

  const renderForgotPasswordResetStep = () => (
    <>
      <Animated.View
        entering={FadeInDown.delay(300).duration(600)}
        style={{ marginBottom: 20 }}
      >
        <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500", marginBottom: 8 }}>
          Nouveau mot de passe <Text style={{ color: "#f87171" }}>*</Text>
        </Text>
        <View style={{ position: "relative" }}>
          <TextInput
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              if (authError) setAuthError(null);
            }}
            placeholder="Nouveau mot de passe"
            placeholderTextColor="#6b7280"
            secureTextEntry={!showNewPassword}
            style={{
              height: 56,
              paddingHorizontal: 20,
              paddingRight: 60,
              borderRadius: 16,
              fontSize: 16,
              color: "#ffffff",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderWidth: 1,
              borderColor: authError
                ? "rgba(239, 68, 68, 0.5)"
                : "rgba(255, 255, 255, 0.15)",
            }}
          />
          <TouchableOpacity
            onPress={() => setShowNewPassword(!showNewPassword)}
            style={{
              position: "absolute",
              right: 16,
              top: 0,
              bottom: 0,
              justifyContent: "center",
              alignItems: "center",
              width: 40,
              height: 56,
            }}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={showNewPassword ? ViewOffIcon : EyeIcon}
              size={24}
              color="#9ca3af"
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
      <Animated.View
        entering={FadeInDown.delay(400).duration(600)}
        style={{ marginBottom: 20 }}
      >
        <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500", marginBottom: 8 }}>
          Confirmer le mot de passe <Text style={{ color: "#f87171" }}>*</Text>
        </Text>
        <View style={{ position: "relative" }}>
          <TextInput
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (authError) setAuthError(null);
            }}
            placeholder="Confirmer le mot de passe"
            placeholderTextColor="#6b7280"
            secureTextEntry={!showConfirmPassword}
            style={{
              height: 56,
              paddingHorizontal: 20,
              paddingRight: 60,
              borderRadius: 16,
              fontSize: 16,
              color: "#ffffff",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderWidth: 1,
              borderColor: authError
                ? "rgba(239, 68, 68, 0.5)"
                : "rgba(255, 255, 255, 0.15)",
            }}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={{
              position: "absolute",
              right: 16,
              top: 0,
              bottom: 0,
              justifyContent: "center",
              alignItems: "center",
              width: 40,
              height: 56,
            }}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={showConfirmPassword ? ViewOffIcon : EyeIcon}
              size={24}
              color="#9ca3af"
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#000000", "#0a0a0a", "#000000"]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 48,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Header with Logo */}
          <Animated.View
            entering={FadeIn.duration(600)}
            className="items-center mb-12"
          >
            <Animated.View
              entering={FadeInDown.delay(100).duration(600)}
              className="mb-6"
            >
              <Image
                source={require("../../assets/logo.png")}
                style={{
                  width: 120,
                  height: 120,
                  resizeMode: "contain",
                }}
              />
            </Animated.View>

            <Text className="text-lg text-gray-400 font-normal">
              {getStepTitle()}
            </Text>
          </Animated.View>

          {/* Bouton Retour */}
          {showForgotPassword && forgotPasswordStep === "email" && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={{ marginBottom: 20 }}
            >
              <TouchableOpacity
                onPress={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordStep("email");
                  setForgotPasswordEmail("");
                  setForgotPasswordOtpCode("");
                  setForgotPasswordRequiresMFA(false);
                  setForgotPasswordRequiresSecurity(false);
                  setForgotPasswordSecurityQuestions([]);
                  setForgotPasswordSecurityAnswers({});
                  setForgotPasswordCurrentQuestionIndex(0);
                  setForgotPasswordCurrentAnswer("");
                  setForgotPasswordMfaValidated(false);
                  setForgotPasswordSecurityValidated(false);
                  setNewPassword("");
                  setConfirmPassword("");
                  setAuthError(null);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                }}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  size={20}
                  color="#9ca3af"
                />
                <Text className="text-gray-400 text-sm ml-2 font-medium">
                  Retour à la connexion
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          {(showForgotPassword
            ? forgotPasswordStep !== "email"
            : step !== "email") &&
            !isAccountDisabled && (
              <Animated.View
                entering={FadeInDown.duration(400)}
                style={{ marginBottom: 20 }}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (showForgotPassword) {
                      if (forgotPasswordStep === "otp") {
                        setForgotPasswordStep("email");
                        setForgotPasswordOtpCode("");
                      } else if (forgotPasswordStep === "security") {
                        if (forgotPasswordMfaValidated) {
                          setForgotPasswordStep("otp");
                        } else {
                          setForgotPasswordStep("email");
                        }
                        setForgotPasswordSecurityAnswers({});
                        setForgotPasswordCurrentAnswer("");
                        setForgotPasswordCurrentQuestionIndex(0);
                      } else if (forgotPasswordStep === "reset") {
                        if (forgotPasswordSecurityValidated) {
                          setForgotPasswordStep("security");
                        } else if (forgotPasswordMfaValidated) {
                          setForgotPasswordStep("otp");
                        } else {
                          setForgotPasswordStep("email");
                        }
                      }
                    } else {
                      handleGoBack();
                    }
                    setAuthError(null);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                  }}
                  activeOpacity={0.7}
                >
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={20}
                    color="#9ca3af"
                  />
                  <Text className="text-gray-400 text-sm ml-2 font-medium">
                    Retour
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}

          {/* Form */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
            className="w-full"
          >
            {showForgotPassword ? (
              <>
                {forgotPasswordStep === "email" &&
                  renderForgotPasswordEmailStep()}
                {forgotPasswordStep === "otp" && renderForgotPasswordOTPStep()}
                {forgotPasswordStep === "security" &&
                  renderForgotPasswordSecurityStep()}
                {forgotPasswordStep === "reset" &&
                  renderForgotPasswordResetStep()}
              </>
            ) : (
              <>
                {step === "email" && renderEmailPasswordStep()}
                {step === "2fa" && render2FAStep()}
                {step === "security" && renderSecurityQuestionsStep()}
              </>
            )}

            {/* Auth Error Message */}
            {authError && (
              <Animated.View
                entering={FadeInDown.duration(400)}
                style={{
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: isAccountDisabled
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(239, 68, 68, 0.05)",
                  borderWidth: 1,
                  borderColor: isAccountDisabled
                    ? "rgba(239, 68, 68, 0.3)"
                    : "rgba(239, 68, 68, 0.2)",
                }}
              >
                <Text
                  className={`text-sm font-medium text-center ${
                    isAccountDisabled ? "text-red-400" : "text-red-400"
                  }`}
                  style={{ lineHeight: 20 }}
                >
                  {authError}
                </Text>
                {isAccountDisabled && (
                  <Text
                    className="text-xs text-gray-400 mt-3 text-center"
                    style={{ lineHeight: 16 }}
                  >
                    Vous ne pouvez plus effectuer de nouvelles tentatives de
                    connexion.
                  </Text>
                )}
              </Animated.View>
            )}

            {/* Submit Button */}
            <Animated.View
              entering={FadeInDown.delay(500).duration(600)}
              style={{ marginTop: 8 }}
            >
              <LinearGradient
                colors={["#0ea5e9", "#0284c7", "#0369a1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  shadowColor: "#0ea5e9",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 12,
                }}
              >
                <Button
                  onPress={handleStepSubmit}
                  loading={
                    showForgotPassword ? forgotPasswordIsSubmitting : loading
                  }
                  disabled={
                    isAccountDisabled ||
                    (showForgotPassword
                      ? forgotPasswordIsSubmitting ||
                        (forgotPasswordStep === "email" &&
                          !forgotPasswordEmail.trim()) ||
                        (forgotPasswordStep === "otp" &&
                          forgotPasswordOtpCode.length !== 6) ||
                        (forgotPasswordStep === "security" &&
                          !forgotPasswordCurrentAnswer.trim()) ||
                        (forgotPasswordStep === "reset" &&
                          (!newPassword || !confirmPassword))
                      : false)
                  }
                  className="h-14 bg-transparent border-0"
                  style={{
                    backgroundColor: "transparent",
                    opacity: isAccountDisabled ? 0.5 : 1,
                  }}
                >
                  <Text className="text-white text-base font-semibold">
                    {isAccountDisabled
                      ? "Compte désactivé"
                      : getStepButtonText()}
                  </Text>
                </Button>
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
