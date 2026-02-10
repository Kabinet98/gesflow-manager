import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/contexts/ThemeContext";
import { authService } from "@/services/auth.service";
import { ScreenHeader } from "@/components/ScreenHeader";
import { REFRESH_CONTROL_COLOR } from "@/constants/layout";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  LockKeyIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  PlusSignCircleIcon,
  Edit01Icon,
  Delete01Icon,
  EyeIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { User } from "@/types";
import api from "@/config/api";

interface SecurityQuestion {
  id?: string;
  question: string;
  answer: string;
}

export function SecurityQuestionsScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState({
    question: "",
    answer: "",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    newQuestionAnswer: false,
    editQuestionAnswer: false,
  });
  const [error, setError] = useState<string | null>(null);
  // État local pour gérer l'affichage des formulaires (mode édition)
  const [showForms, setShowForms] = useState(false);
  // État pour contrôler l'affichage du formulaire d'ajout
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setError(null);
          // Charger les questions en arrière-plan, ne pas bloquer le rendu en cas d'erreur
          await fetchQuestions();
          
          // Vérifier après le chargement des questions si on doit activer
          // Attendre un peu pour s'assurer que tout est synchronisé
          setTimeout(async () => {
            try {
              const questionsResponse = await api
                .get("/api/security-questions")
                .catch(() => ({ data: [] }));
              const questionsData = Array.isArray(questionsResponse.data)
                ? questionsResponse.data
                : [];
              
              if (questionsData.length >= 2) {
                const refreshedUser = await authService.getCurrentUser();
                if (refreshedUser && !refreshedUser.securityQuestionsEnabled) {
                  try {
                    const response = await api.put("/api/users/security", {
                      enabled: true,
                    });
                    // Attendre un peu avant de rafraîchir
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    await refreshUser();
                    // Attendre encore un peu et re-vérifier
                    setTimeout(async () => {
                      const updatedUser = await authService.getCurrentUser();
                      setUser(updatedUser);
                      setShowForms(true);
                    }, 300);
                  } catch (error: any) {
                    // Erreur silencieuse
                  }
                }
              }
            } catch (error: any) {
              // Erreur silencieuse
            }
          }, 300);
        } else {
        setError("Utilisateur non trouvé");
      }
    } catch (error: any) {
      // Gérer l'erreur silencieusement, l'utilisateur sera redirigé si nécessaire
      setError("Erreur lors du chargement");
    }
    };
    loadData();
  }, []);

  const refreshUser = async () => {
    try {
      // Utiliser refreshUser() qui fait un vrai appel API au lieu de getCurrentUser() qui retourne le cache
      const currentUser = await authService.refreshUser();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (error) {
      // En cas d'erreur, essayer quand même de récupérer depuis le cache
      try {
        const cachedUser = await authService.getCurrentUser();
        if (cachedUser) {
          setUser(cachedUser);
        }
      } catch (cacheError) {
        // Erreur silencieuse
      }
    }
  };

  // Fonction pour le refresh control
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      await fetchQuestions();
    } catch (error) {
      // Erreur silencieuse
    } finally {
      setRefreshing(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      setIsLoadingQuestions(true);
      // Selon GesFlow, l'endpoint est /api/security-questions (GET)
      const response = await api.get("/api/security-questions");
      // S'assurer que response.data est un tableau
      const questionsData = response.data;
      if (Array.isArray(questionsData)) {
        setQuestions(questionsData);
        
        // Si on a au moins 2 questions et que ce n'est pas encore activé, activer automatiquement
        if (questionsData.length >= 2) {
          // Attendre un peu pour s'assurer que le user est chargé
          setTimeout(async () => {
            try {
              const currentUser = await authService.getCurrentUser();
              if (currentUser && !currentUser.securityQuestionsEnabled) {
                try {
                  await api.put("/api/users/security", {
                    enabled: true,
                  });
                  await new Promise((resolve) => setTimeout(resolve, 200));
                  await refreshUser();
                  setShowForms(true);
                } catch (error: any) {
                  // Erreur silencieuse pour l'activation automatique
                }
              }
            } catch (error: any) {
              // Erreur silencieuse
            }
          }, 200);
        }
      } else {
        setQuestions([]);
      }
    } catch (error: any) {
      // Ne pas afficher d'erreur si c'est une 404 (pas encore de questions)
      // Si c'est une 401, l'intercepteur API gérera la déconnexion
      // Toujours mettre un tableau vide en cas d'erreur
      setQuestions([]);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }

    try {
      setLoading(true);
      // Selon GesFlow, l'endpoint est /api/security-questions (POST)
      // Normaliser la réponse pour qu'elle ne soit pas sensible à la casse
      await api.post("/api/security-questions", {
        question: newQuestion.trim(),
        answer: newAnswer.trim().toLowerCase(),
      });
      // Recharger les questions après l'ajout
      await fetchQuestions();
      await refreshUser();
      setNewQuestion("");
      setNewAnswer("");
      setIsAdding(false);
      // Cacher le formulaire après l'ajout réussi
      setShowAddForm(false);

      // Vérifier le nombre de questions après le rechargement
      // Utiliser un petit délai pour s'assurer que le state est mis à jour
      setTimeout(async () => {
        try {
          const response = await api
            .get("/api/security-questions")
            .catch(() => ({ data: [] }));
          const updatedQuestions = Array.isArray(response.data)
            ? response.data
            : [];

          // Si on a maintenant au moins 2 questions et que ce n'est pas encore activé, activer automatiquement
          if (updatedQuestions.length >= 2) {
            const refreshedUser = await authService.getCurrentUser();
            if (refreshedUser && !refreshedUser.securityQuestionsEnabled) {
              try {
                await api.put("/api/users/security", {
                  enabled: true,
                });
                await refreshUser();
                setShowForms(true);
                // Pas d'alerte pour l'activation automatique
              } catch (error: any) {
                // Erreur silencieuse pour l'activation automatique
              }
            }
          }
        } catch (error: any) {
          // Erreur silencieuse
        }
      }, 100);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Impossible d'ajouter la question";
      if (error.response?.status === 401) {
        Alert.alert(
          "Session expirée",
          "Votre session a expiré. Veuillez vous reconnecter.",
          [
            {
              text: "OK",
              onPress: async () => {
                await authService.logout();
              },
            },
          ]
        );
      } else {
        Alert.alert("Erreur", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    Alert.alert(
      "Supprimer la question",
      "Êtes-vous sûr de vouloir supprimer cette question de sécurité ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              // Selon GesFlow, l'endpoint est /api/security-questions/{id} (DELETE)
              await api.delete(`/api/security-questions/${questionId}`);
              await fetchQuestions();
              
              // Vérifier si on a maintenant moins de 2 questions, désactiver automatiquement
              const response = await api
                .get("/api/security-questions")
                .catch(() => ({ data: [] }));
              const remainingQuestions = Array.isArray(response.data)
                ? response.data
                : [];
              
              if (remainingQuestions.length < 2) {
                const currentUser = await authService.getCurrentUser();
                if (currentUser && currentUser.securityQuestionsEnabled) {
                  try {
                    await api.put("/api/users/security", {
                      enabled: false,
                    });
                    setShowForms(false);
                  } catch (error: any) {
                    // Erreur silencieuse
                  }
                }
              }
              
              await refreshUser();
              Alert.alert("Succès", "Question supprimée avec succès");
            } catch (error: any) {
              const errorMessage =
                error.response?.data?.error ||
                error.message ||
                "Impossible de supprimer la question";
              if (error.response?.status === 401) {
                Alert.alert(
                  "Session expirée",
                  "Votre session a expiré. Veuillez vous reconnecter.",
                  [
                    {
                      text: "OK",
                      onPress: async () => {
                        await authService.logout();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert("Erreur", errorMessage);
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleSecurity = async (enabled: boolean) => {
    try {
      setLoading(true);
      
      // Toujours mettre à jour l'API avec la nouvelle valeur
      await api.put("/api/users/security", {
        enabled: enabled,
      });
      await refreshUser();
      
      // Synchroniser showForms avec la nouvelle valeur
      setShowForms(enabled);
      
      if (enabled) {
        // Si on active mais qu'on n'a pas encore 2 questions, juste afficher les formulaires
        if (Array.isArray(questions) && questions.length < 2) {
          // Pas d'alerte, juste afficher les formulaires pour permettre l'ajout
        } else {
          Alert.alert("Succès", "Questions de sécurité activées");
        }
      } else {
        // Pas d'alerte pour la désactivation
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        (enabled
          ? "Impossible d'activer les questions de sécurité"
          : "Impossible de désactiver les questions de sécurité");
      if (error.response?.status === 401) {
        Alert.alert(
          "Session expirée",
          "Votre session a expiré. Veuillez vous reconnecter.",
          [
            {
              text: "OK",
              onPress: async () => {
                await authService.logout();
              },
            },
          ]
        );
      } else {
        Alert.alert("Erreur", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuestion = (question: SecurityQuestion) => {
    setEditingId(question.id || null);
    setEditingQuestion({ question: question.question, answer: "" });
  };

  const handleUpdateQuestion = async () => {
    if (!editingId || !editingQuestion.question.trim()) {
      return;
    }

    try {
      setLoading(true);
      // Selon GesFlow, l'endpoint est /api/security-questions/{id} (PUT)
      // Normaliser la réponse pour qu'elle ne soit pas sensible à la casse (si fournie)
      await api.put(`/api/security-questions/${editingId}`, {
        question: editingQuestion.question.trim(),
        answer: editingQuestion.answer 
          ? editingQuestion.answer.trim().toLowerCase() 
          : undefined, // Laisser vide pour ne pas changer
      });
      await fetchQuestions();
      await refreshUser();
      setEditingId(null);
      setEditingQuestion({ question: "", answer: "" });
      Alert.alert("Succès", "Question mise à jour avec succès");
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Impossible de mettre à jour la question";
      if (error.response?.status === 401) {
        Alert.alert(
          "Session expirée",
          "Votre session a expiré. Veuillez vous reconnecter.",
          [
            {
              text: "OK",
              onPress: async () => {
                await authService.logout();
              },
            },
          ]
        );
      } else {
        Alert.alert("Erreur", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = user?.securityQuestionsEnabled || false;
  // Synchroniser showForms avec isEnabled
  useEffect(() => {
    // Si activé, toujours afficher les formulaires
    if (isEnabled) {
      setShowForms(true);
    }
  }, [isEnabled]);

  // Activer automatiquement si on a 2+ questions mais que ce n'est pas encore activé
  useEffect(() => {
    const activateIfNeeded = async () => {
      // Vérifier à nouveau les questions depuis l'API pour être sûr
      try {
        const questionsResponse = await api
          .get("/api/security-questions")
          .catch(() => ({ data: [] }));
        const questionsData = Array.isArray(questionsResponse.data)
          ? questionsResponse.data
          : [];

        if (questionsData.length >= 2) {
          const currentUser = await authService.getCurrentUser();
          if (currentUser && !currentUser.securityQuestionsEnabled) {
            try {
              const response = await api.put("/api/users/security", {
                enabled: true,
              });
              // Attendre un peu avant de rafraîchir
              await new Promise((resolve) => setTimeout(resolve, 200));
              await refreshUser();
              // Re-vérifier après le refresh
              setTimeout(async () => {
                const updatedUser = await authService.getCurrentUser();
                if (updatedUser) {
                  setUser(updatedUser);
                  setShowForms(true);
                }
              }, 300);
            } catch (error: any) {
              // Erreur silencieuse
            }
          }
        }
      } catch (error: any) {
        // Erreur silencieuse
      }
    };

    // Se déclencher quand on a des questions ET un utilisateur chargé
    if (user && Array.isArray(questions) && questions.length >= 2) {
      // Attendre un peu pour s'assurer que tout est synchronisé
      const timer = setTimeout(() => {
        activateIfNeeded();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length, user?.id, user?.securityQuestionsEnabled]);

  // Afficher le formulaire directement si on n'a pas encore de questions
  useEffect(() => {
    if (Array.isArray(questions) && questions.length === 0 && showForms) {
      setShowAddForm(true);
    } else if (Array.isArray(questions) && questions.length > 0) {
      setShowAddForm(false);
    }
  }, [questions.length, showForms]);

  // Si erreur de chargement, afficher un message
  if (error && !user) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
        edges={["top", "bottom"]}
      >
        <ScreenHeader title="Sécurité" />
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className={`text-base ${isDark ? "text-gray-400" : "text-gray-600"}`}
          >
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
      edges={["top", "bottom"]}
    >
      <ScreenHeader title="Sécurité" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#38bdf8" : REFRESH_CONTROL_COLOR}
            colors={isDark ? ["#38bdf8"] : [REFRESH_CONTROL_COLOR]}
          />
        }
      >
        <View className="px-6 pt-20 pb-4">
          {/* Statut actuel */}
          <View
            className={`mb-6 rounded-xl p-4 ${
              isDark ? "bg-[#1e293b]" : "bg-gray-50"
            }`}
            style={styles.card}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-3"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(14, 165, 233, 0.2)"
                      : "rgba(14, 165, 233, 0.1)",
                  }}
                >
                  <HugeiconsIcon icon={LockKeyIcon} size={24} color="#0ea5e9" />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base font-semibold mb-1 ${
                      isDark ? "text-gray-100" : "text-gray-900"
                    }`}
                  >
                    Statut
                  </Text>
                  <View className="flex-row items-center">
                    <HugeiconsIcon
                      icon={isEnabled ? CheckmarkCircle02Icon : Cancel01Icon}
                      size={16}
                      color={isEnabled ? "#10b981" : "#ef4444"}
                    />
                    <Text
                      className={`ml-2 text-sm ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {isEnabled ? "Activées" : "Désactivées"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <Text
              className={`text-xs mt-2 ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {isLoadingQuestions 
                ? "Chargement..." 
                : `${Array.isArray(questions) ? questions.length : 0} question(s) configurée(s)`}
            </Text>
          </View>

          {/* Toggle Activation */}
          <View
            className={`mb-6 rounded-xl p-4 ${
              isDark ? "bg-[#1e293b]" : "bg-gray-50"
            }`}
            style={styles.card}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <HugeiconsIcon
                    icon={LockKeyIcon}
                    size={16}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-gray-100" : "text-gray-900"
                    }`}
                  >
                    Activer les Questions de Sécurité
                  </Text>
                </View>
                <Text
                  className={`text-sm ml-6 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Les questions de sécurité seront demandées lors de la
                  connexion après le mot de passe et le code 2FA (si activé).
                  Vous avez droit à 3 tentatives maximum, sinon votre compte
                  sera désactivé.
                </Text>
              </View>
              {/* Toggle synchronisé avec l'état réel isEnabled */}
              <TouchableOpacity
                onPress={() => handleToggleSecurity(!isEnabled)}
                disabled={loading}
                className={`w-12 h-7 rounded-full flex-row items-center px-1 ${
                  isEnabled
                    ? isDark
                      ? "bg-blue-600"
                      : "bg-blue-500"
                    : isDark
                      ? "bg-gray-600"
                      : "bg-gray-300"
                }`}
                style={{
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white`}
                  style={{
                    transform: [{ translateX: isEnabled ? 20 : 0 }],
                  }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          <View
            className={`mb-6 rounded-xl p-4 ${
              isDark ? "bg-[#1e293b]" : "bg-gray-50"
            }`}
            style={styles.card}
          >
            <Text
              className={`text-sm leading-6 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Configurez des questions de sécurité pour renforcer la protection
              de votre compte. Les questions de sécurité peuvent être utilisées
              en complément du MFA.
              {"\n\n"}
              <Text className={isDark ? "text-yellow-400" : "text-yellow-700"}>
                ⚠️ Vous devez configurer au moins 2 questions de sécurité avant
                de pouvoir activer cette fonctionnalité.
              </Text>
            </Text>
          </View>

          {/* Liste des questions - Visible seulement si les formulaires sont affichés et questions chargées */}
          {showForms && !isLoadingQuestions && Array.isArray(questions) && questions.length > 0 && (
            <View
              className={`mb-6 rounded-xl p-4 ${
                isDark ? "bg-[#1e293b]" : "bg-gray-50"
              }`}
              style={styles.card}
            >
              <Text
                className={`text-base font-semibold mb-4 ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
              >
                Questions Configurées ({questions.length})
              </Text>
              {Array.isArray(questions) &&
                questions.map((q, index) => (
                  <View
                    key={q.id || index}
                    className={`mb-3 p-4 rounded-lg ${
                      isDark ? "bg-[#0f172a]" : "bg-white"
                    }`}
                    style={{
                      borderWidth: 1,
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    {editingId === q.id ? (
                      <View>
                        <View style={{ marginBottom: 12 }}>
                          <Text
                            className={`text-sm font-medium mb-2 ${
                              isDark ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            Question <Text className="text-red-500">*</Text>
                          </Text>
                          <TextInput
                            value={editingQuestion.question}
                            onChangeText={(text) =>
                              setEditingQuestion({
                                ...editingQuestion,
                                question: text,
                              })
                            }
                            placeholder="Votre question"
                            placeholderTextColor={
                              isDark
                                ? "rgba(255, 255, 255, 0.5)"
                                : "rgba(0, 0, 0, 0.5)"
                            }
                            className={`p-3 rounded-lg ${
                              isDark
                                ? "bg-[#1e293b] text-white"
                                : "bg-gray-50 text-gray-900"
                            }`}
                            style={{
                              borderWidth: 1,
                              borderColor: isDark
                                ? "rgba(255, 255, 255, 0.1)"
                                : "rgba(0, 0, 0, 0.1)",
                            }}
                          />
                        </View>
                        <View style={{ marginBottom: 12 }}>
                          <Text
                            className={`text-sm font-medium mb-2 ${
                              isDark ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            Nouvelle Réponse (laisser vide pour ne pas changer)
                          </Text>
                          <View style={{ position: "relative" }}>
                            <TextInput
                              value={editingQuestion.answer}
                              onChangeText={(text) =>
                                setEditingQuestion({
                                  ...editingQuestion,
                                  answer: text,
                                })
                              }
                              placeholder="Nouvelle réponse"
                              placeholderTextColor={
                                isDark
                                  ? "rgba(255, 255, 255, 0.5)"
                                  : "rgba(0, 0, 0, 0.5)"
                              }
                              secureTextEntry={
                                !showPasswords.editQuestionAnswer
                              }
                              className={`p-3 pr-12 rounded-lg ${
                                isDark
                                  ? "bg-[#1e293b] text-white"
                                  : "bg-gray-50 text-gray-900"
                              }`}
                              style={{
                                borderWidth: 1,
                                borderColor: isDark
                                  ? "rgba(255, 255, 255, 0.1)"
                                  : "rgba(0, 0, 0, 0.1)",
                              }}
                            />
                            <TouchableOpacity
                              onPress={() =>
                                setShowPasswords({
                                  ...showPasswords,
                                  editQuestionAnswer:
                                    !showPasswords.editQuestionAnswer,
                                })
                              }
                              style={{
                                position: "absolute",
                                right: 12,
                                top: "50%",
                                transform: [{ translateY: -10 }],
                              }}
                            >
                              <HugeiconsIcon
                                icon={
                                  showPasswords.editQuestionAnswer
                                    ? ViewOffIcon
                                    : EyeIcon
                                }
                                size={20}
                                color={isDark ? "#9ca3af" : "#6b7280"}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            onPress={handleUpdateQuestion}
                            disabled={
                              loading || !editingQuestion.question.trim()
                            }
                            className={`flex-1 px-4 py-2 rounded-lg items-center ${
                              isDark ? "bg-blue-600" : "bg-blue-500"
                            }`}
                            style={{
                              opacity: editingQuestion.question.trim()
                                ? 1
                                : 0.5,
                            }}
                          >
                            {loading ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text className="text-white font-semibold">
                                Enregistrer
                              </Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingId(null);
                              setEditingQuestion({ question: "", answer: "" });
                            }}
                            className={`px-4 py-2 rounded-lg items-center ${
                              isDark ? "bg-[#1e293b]" : "bg-gray-100"
                            }`}
                          >
                            <Text
                              className={
                                isDark ? "text-gray-300" : "text-gray-700"
                              }
                            >
                              Annuler
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row items-start justify-between gap-4">
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2 mb-1">
                            <Text
                              className={`text-sm font-medium ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              Question #{index + 1}
                            </Text>
                          </View>
                          <Text
                            className={`text-base ${
                              isDark ? "text-gray-200" : "text-gray-800"
                            }`}
                          >
                            {q.question}
                          </Text>
                        </View>
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            onPress={() => handleEditQuestion(q)}
                            disabled={loading}
                            className={`p-2 rounded-lg ${
                              isDark ? "bg-blue-600" : "bg-blue-500"
                            }`}
                          >
                            <HugeiconsIcon
                              icon={Edit01Icon}
                              size={16}
                              color="#ffffff"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteQuestion(q.id!)}
                            disabled={loading}
                            className={`p-2 rounded-lg ${
                              isDark ? "bg-red-600" : "bg-red-500"
                            }`}
                          >
                            <HugeiconsIcon
                              icon={Delete01Icon}
                              size={16}
                              color="#ffffff"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
            </View>
          )}

          {/* Formulaire d'ajout ou bouton - Visible seulement si les formulaires sont affichés */}
          {showForms && (
            <>
              {showAddForm ? (
                <View
                  className={`mb-6 rounded-xl p-4 ${
                    isDark ? "bg-[#1e293b]" : "bg-gray-50"
                  }`}
                  style={styles.card}
                >
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-2">
                      <HugeiconsIcon
                        icon={PlusSignCircleIcon}
                        size={20}
                        color={isDark ? "#9ca3af" : "#6b7280"}
                      />
                      <Text
                        className={`text-base font-semibold ${
                          isDark ? "text-gray-100" : "text-gray-900"
                        }`}
                      >
                        Ajouter une Question de Sécurité
                      </Text>
                    </View>
                    {!isLoadingQuestions && Array.isArray(questions) && questions.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setShowAddForm(false)}
                        className={`px-3 py-1 rounded-lg ${
                          isDark ? "bg-[#0f172a]" : "bg-gray-200"
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            isDark ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          Annuler
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View>
                    <View style={{ marginBottom: 12 }}>
                      <Text
                        className={`text-sm font-medium mb-2 ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Question <Text className="text-red-500">*</Text>
                      </Text>
                      <TextInput
                        value={newQuestion}
                        onChangeText={setNewQuestion}
                        placeholder="Ex: Quel est le nom de votre premier animal de compagnie ?"
                        placeholderTextColor={
                          isDark
                            ? "rgba(255, 255, 255, 0.5)"
                            : "rgba(0, 0, 0, 0.5)"
                        }
                        className={`p-3 rounded-lg ${
                          isDark
                            ? "bg-[#0f172a] text-white"
                            : "bg-white text-gray-900"
                        }`}
                        style={{
                          borderWidth: 1,
                          borderColor: isDark
                            ? "rgba(255, 255, 255, 0.1)"
                            : "rgba(0, 0, 0, 0.1)",
                        }}
                      />
                    </View>
                    <View style={{ marginBottom: 12 }}>
                      <Text
                        className={`text-sm font-medium mb-2 ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Réponse <Text className="text-red-500">*</Text>
                      </Text>
                      <View style={{ position: "relative" }}>
                        <TextInput
                          value={newAnswer}
                          onChangeText={setNewAnswer}
                          placeholder="Votre réponse"
                          placeholderTextColor={
                            isDark
                              ? "rgba(255, 255, 255, 0.5)"
                              : "rgba(0, 0, 0, 0.5)"
                          }
                          secureTextEntry={!showPasswords.newQuestionAnswer}
                          className={`p-3 pr-12 rounded-lg ${
                            isDark
                              ? "bg-[#0f172a] text-white"
                              : "bg-white text-gray-900"
                          }`}
                          style={{
                            borderWidth: 1,
                            borderColor: isDark
                              ? "rgba(255, 255, 255, 0.1)"
                              : "rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <TouchableOpacity
                          onPress={() =>
                            setShowPasswords({
                              ...showPasswords,
                              newQuestionAnswer:
                                !showPasswords.newQuestionAnswer,
                            })
                          }
                          style={{
                            position: "absolute",
                            right: 12,
                            top: "50%",
                            transform: [{ translateY: -10 }],
                          }}
                        >
                          <HugeiconsIcon
                            icon={
                              showPasswords.newQuestionAnswer
                                ? ViewOffIcon
                                : EyeIcon
                            }
                            size={20}
                            color={isDark ? "#9ca3af" : "#6b7280"}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={handleAddQuestion}
                      disabled={
                        loading || !newQuestion.trim() || !newAnswer.trim()
                      }
                      className={`rounded-xl p-4 flex-row items-center justify-center ${
                        isDark ? "bg-blue-600" : "bg-blue-500"
                      }`}
                      style={{
                        opacity:
                          newQuestion.trim() && newAnswer.trim() ? 1 : 0.5,
                      }}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <HugeiconsIcon
                            icon={PlusSignCircleIcon}
                            size={20}
                            color="#ffffff"
                          />
                          <Text className="text-white font-semibold ml-2">
                            Ajouter la Question
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // Bouton pour afficher le formulaire si on a déjà des questions
                !isLoadingQuestions && Array.isArray(questions) && questions.length > 0 ? (
                  <View
                    className={`mb-6 rounded-xl p-4 ${
                      isDark ? "bg-[#1e293b]" : "bg-gray-50"
                    }`}
                    style={styles.card}
                  >
                    <TouchableOpacity
                      onPress={() => setShowAddForm(true)}
                      className={`rounded-xl p-4 flex-row items-center justify-center ${
                        isDark ? "bg-blue-600" : "bg-blue-500"
                      }`}
                    >
                      <HugeiconsIcon
                        icon={PlusSignCircleIcon}
                        size={20}
                        color="#ffffff"
                      />
                      <Text className="text-white font-semibold ml-2">
                        Ajouter une autre question
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : !isLoadingQuestions ? (
                  // Si pas de questions (et chargement terminé), afficher le formulaire directement
                  <View
                    className={`mb-6 rounded-xl p-4 ${
                      isDark ? "bg-[#1e293b]" : "bg-gray-50"
                    }`}
                    style={styles.card}
                  >
                    <View className="flex-row items-center gap-2 mb-4">
                      <HugeiconsIcon
                        icon={PlusSignCircleIcon}
                        size={20}
                        color={isDark ? "#9ca3af" : "#6b7280"}
                      />
                      <Text
                        className={`text-base font-semibold ${
                          isDark ? "text-gray-100" : "text-gray-900"
                        }`}
                      >
                        Ajouter une Question de Sécurité
                      </Text>
                    </View>
                    <View>
                      <View style={{ marginBottom: 12 }}>
                        <Text
                          className={`text-sm font-medium mb-2 ${
                            isDark ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          Question <Text className="text-red-500">*</Text>
                        </Text>
                        <TextInput
                          value={newQuestion}
                          onChangeText={setNewQuestion}
                          placeholder="Ex: Quel est le nom de votre premier animal de compagnie ?"
                          placeholderTextColor={
                            isDark
                              ? "rgba(255, 255, 255, 0.5)"
                              : "rgba(0, 0, 0, 0.5)"
                          }
                          className={`p-3 rounded-lg ${
                            isDark
                              ? "bg-[#0f172a] text-white"
                              : "bg-white text-gray-900"
                          }`}
                          style={{
                            borderWidth: 1,
                            borderColor: isDark
                              ? "rgba(255, 255, 255, 0.1)"
                              : "rgba(0, 0, 0, 0.1)",
                          }}
                        />
                      </View>
                      <View style={{ marginBottom: 12 }}>
                        <Text
                          className={`text-sm font-medium mb-2 ${
                            isDark ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          Réponse <Text className="text-red-500">*</Text>
                        </Text>
                        <View style={{ position: "relative" }}>
                          <TextInput
                            value={newAnswer}
                            onChangeText={setNewAnswer}
                            placeholder="Votre réponse"
                            placeholderTextColor={
                              isDark
                                ? "rgba(255, 255, 255, 0.5)"
                                : "rgba(0, 0, 0, 0.5)"
                            }
                            secureTextEntry={!showPasswords.newQuestionAnswer}
                            className={`p-3 pr-12 rounded-lg ${
                              isDark
                                ? "bg-[#0f172a] text-white"
                                : "bg-white text-gray-900"
                            }`}
                            style={{
                              borderWidth: 1,
                              borderColor: isDark
                                ? "rgba(255, 255, 255, 0.1)"
                                : "rgba(0, 0, 0, 0.1)",
                            }}
                          />
                          <TouchableOpacity
                            onPress={() =>
                              setShowPasswords({
                                ...showPasswords,
                                newQuestionAnswer:
                                  !showPasswords.newQuestionAnswer,
                              })
                            }
                            style={{
                              position: "absolute",
                              right: 12,
                              top: "50%",
                              transform: [{ translateY: -10 }],
                            }}
                          >
                            <HugeiconsIcon
                              icon={
                                showPasswords.newQuestionAnswer
                                  ? ViewOffIcon
                                  : EyeIcon
                              }
                              size={20}
                              color={isDark ? "#9ca3af" : "#6b7280"}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={handleAddQuestion}
                        disabled={
                          loading || !newQuestion.trim() || !newAnswer.trim()
                        }
                        className={`rounded-xl p-4 flex-row items-center justify-center ${
                          isDark ? "bg-blue-600" : "bg-blue-500"
                        }`}
                        style={{
                          opacity:
                            newQuestion.trim() && newAnswer.trim() ? 1 : 0.5,
                        }}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <HugeiconsIcon
                              icon={PlusSignCircleIcon}
                              size={20}
                              color="#ffffff"
                            />
                            <Text className="text-white font-semibold ml-2">
                              Ajouter la Question
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null
              )}
            </>
          )}

          {isEnabled && !isLoadingQuestions && Array.isArray(questions) && questions.length === 0 && (
            <View className="items-center py-8">
              <HugeiconsIcon
                icon={LockKeyIcon}
                size={48}
                color={isDark ? "#4b5563" : "#9ca3af"}
                style={{ opacity: 0.5 }}
              />
              <Text
                className={`text-center mt-3 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Aucune question de sécurité configurée
              </Text>
              <Text
                className={`text-sm text-center mt-1 ${
                  isDark ? "text-gray-500" : "text-gray-500"
                }`}
              >
                Ajoutez votre première question ci-dessus
              </Text>
            </View>
          )}
          
          {/* Indicateur de chargement pour les questions */}
          {isLoadingQuestions && (
            <View className="items-center py-8">
              <ActivityIndicator
                size="large"
                color={isDark ? "#60a5fa" : "#0ea5e9"}
              />
              <Text
                className={`text-center mt-3 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Chargement des questions...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
