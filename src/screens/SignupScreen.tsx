import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { EyeIcon, ViewOffIcon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { getApiBaseUrl } from "@/config/env";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])/;

const signupSchema = z
  .object({
    email: z
      .string()
      .min(1, "L'email est requis")
      .email("Format d'email invalide")
      .max(255)
      .toLowerCase()
      .trim(),
    name: z.string().min(1, "Le nom est requis").max(255).trim(),
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .max(255)
      .regex(PASSWORD_REGEX, "Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial"),
    confirmPassword: z.string().min(1, "La confirmation du mot de passe est requise"),
    workspaceName: z.string().min(1, "Le nom du workspace est requis").max(255).trim(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

const inputStyle = {
  height: 56,
  paddingHorizontal: 20,
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
};

export function SignupScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
    watch,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
      workspaceName: "",
    },
  });

  const email = watch("email");
  const name = watch("name");
  const password = watch("password");
  const confirmPassword = watch("confirmPassword");
  const workspaceName = watch("workspaceName");

  const canProceedStep1 =
    !!email?.trim() &&
    !!name?.trim() &&
    !!password &&
    !!confirmPassword &&
    password === confirmPassword &&
    password.length >= 8;

  // Quand la validation échoue sur un champ de l’étape 1 alors qu’on est à l’étape 2, revenir à l’étape 1 pour afficher les erreurs
  useEffect(() => {
    if (step !== 2) return;
    const hasStep1Error =
      errors.email || errors.name || errors.password || errors.confirmPassword;
    if (hasStep1Error) setStep(1);
  }, [errors.email, errors.name, errors.password, errors.confirmPassword, step]);

  const onStep1Next = async () => {
    const ok = await trigger(["email", "name", "password", "confirmPassword"]);
    if (ok) setStep(2);
  };

  const onSubmit = async (data: SignupFormData) => {
    setError(null);
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          name: data.name.trim(),
          password: data.password,
          confirmPassword: data.confirmPassword,
          workspaceName: data.workspaceName.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Erreur lors de l'inscription");
        return;
      }

      Alert.alert(
        "Compte créé",
        "Vous pouvez maintenant vous connecter.",
        [{ text: "OK", onPress: () => navigation.replace("Login") }]
      );
    } catch {
      setError("Une erreur est survenue. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#000000", "#0a0a0a", "#000000"]}
        style={StyleSheet.absoluteFillObject}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          {/* Logo + titre (aligné login) */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.logoSection}>
            <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.logoWrap}>
              <Image
                source={require("../../assets/logo.png")}
                style={styles.logo}
                resizeMode="cover"
              />
            </Animated.View>
            <Text style={styles.logoSubtitle}>
              {step === 1 ? "Étape 1/2 : Vos informations" : "Étape 2/2 : Votre workspace"}
            </Text>
          </Animated.View>

          {/* Bouton Retour */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.backRow}>
            <TouchableOpacity
              onPress={() => (step === 2 ? setStep(1) : navigation.navigate("Login"))}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="#9ca3af" />
              <Text style={styles.backLabel}>Retour</Text>
            </TouchableOpacity>
          </Animated.View>

          {error ? (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          {/* Étape 1 : toujours montée pour garder les valeurs du formulaire, masquée visuellement à l’étape 2 */}
          <View style={{ display: step === 1 ? "flex" : "none" }}>
              <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.field}>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View>
                      <Text style={styles.label}>Email <Text style={{ color: "#f87171" }}>*</Text></Text>
                      <TextInput
                        placeholder="vous@exemple.com"
                        placeholderTextColor="#6b7280"
                        value={value}
                        onChangeText={(t) => { onChange(t); setError(null); }}
                        onBlur={onBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[
                          inputStyle,
                          errors.email && { borderColor: "rgba(239, 68, 68, 0.5)" },
                        ]}
                      />
                      {errors.email ? <Text style={styles.fieldError}>{errors.email.message}</Text> : null}
                    </View>
                  )}
                />
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(350).duration(600)} style={styles.field}>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View>
                      <Text style={styles.label}>Nom <Text style={{ color: "#f87171" }}>*</Text></Text>
                      <TextInput
                        placeholder="Votre nom"
                        placeholderTextColor="#6b7280"
                        value={value}
                        onChangeText={(t) => { onChange(t); setError(null); }}
                        onBlur={onBlur}
                        style={[
                          inputStyle,
                          errors.name && { borderColor: "rgba(239, 68, 68, 0.5)" },
                        ]}
                      />
                      {errors.name ? <Text style={styles.fieldError}>{errors.name.message}</Text> : null}
                    </View>
                  )}
                />
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.field}>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View>
                      <Text style={styles.label}>Mot de passe <Text style={{ color: "#f87171" }}>*</Text></Text>
                      <View style={{ position: "relative" }}>
                        <TextInput
                          placeholder="Min. 8 car., maj., min., chiffre, spécial"
                          placeholderTextColor="#6b7280"
                          value={value}
                          onChangeText={(t) => { onChange(t); setError(null); }}
                          onBlur={onBlur}
                          secureTextEntry={!showPassword}
                          style={[
                            inputStyle,
                            { paddingRight: 56 },
                            errors.password && { borderColor: "rgba(239, 68, 68, 0.5)" },
                          ]}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={styles.eyeBtn}
                          activeOpacity={0.7}
                        >
                          <HugeiconsIcon icon={showPassword ? ViewOffIcon : EyeIcon} size={24} color="#9ca3af" />
                        </TouchableOpacity>
                      </View>
                      {errors.password ? <Text style={styles.fieldError}>{errors.password.message}</Text> : null}
                    </View>
                  )}
                />
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(450).duration(600)} style={styles.field}>
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View>
                      <Text style={styles.label}>Confirmer le mot de passe <Text style={{ color: "#f87171" }}>*</Text></Text>
                      <View style={{ position: "relative" }}>
                        <TextInput
                          placeholder="Confirmez le mot de passe"
                          placeholderTextColor="#6b7280"
                          value={value}
                          onChangeText={(t) => { onChange(t); setError(null); }}
                          onBlur={onBlur}
                          secureTextEntry={!showConfirmPassword}
                          style={[
                            inputStyle,
                            { paddingRight: 56 },
                            errors.confirmPassword && { borderColor: "rgba(239, 68, 68, 0.5)" },
                          ]}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={styles.eyeBtn}
                          activeOpacity={0.7}
                        >
                          <HugeiconsIcon icon={showConfirmPassword ? ViewOffIcon : EyeIcon} size={24} color="#9ca3af" />
                        </TouchableOpacity>
                      </View>
                      {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword.message}</Text> : null}
                    </View>
                  )}
                />
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.submitWrap}>
                <LinearGradient
                  colors={["#0ea5e9", "#0284c7", "#0369a1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Button
                    onPress={onStep1Next}
                    disabled={!canProceedStep1}
                    className="h-14 bg-transparent border-0"
                    style={{ backgroundColor: "transparent" }}
                  >
                    <Text style={styles.buttonText}>Continuer</Text>
                  </Button>
                </LinearGradient>
              </Animated.View>
          </View>

          {/* Étape 2 : toujours montée pour garder les valeurs, masquée à l’étape 1 */}
          <View style={{ display: step === 2 ? "flex" : "none" }}>
              <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.field}>
                <Controller
                  control={control}
                  name="workspaceName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View>
                      <Text style={styles.label}>Nom du workspace <Text style={{ color: "#f87171" }}>*</Text></Text>
                      <TextInput
                        placeholder="Ex: Mon entreprise, Ma famille..."
                        placeholderTextColor="#6b7280"
                        value={value}
                        onChangeText={(t) => { onChange(t); setError(null); }}
                        onBlur={onBlur}
                        style={[
                          inputStyle,
                          errors.workspaceName && { borderColor: "rgba(239, 68, 68, 0.5)" },
                        ]}
                      />
                      {errors.workspaceName ? <Text style={styles.fieldError}>{errors.workspaceName.message}</Text> : null}
                    </View>
                  )}
                />
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.submitWrap}>
                <LinearGradient
                  colors={["#0ea5e9", "#0284c7", "#0369a1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Button
                    onPress={() => handleSubmit(onSubmit)()}
                    loading={loading}
                    disabled={loading}
                    className="h-14 bg-transparent border-0"
                    style={{ backgroundColor: "transparent" }}
                  >
                    <Text style={styles.buttonText}>
                      {loading ? "Création en cours..." : "Créer mon compte"}
                    </Text>
                  </Button>
                </LinearGradient>
              </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.delay(550).duration(600)} style={styles.signinLink}>
            <TouchableOpacity onPress={() => navigation.replace("Login")} activeOpacity={0.7}>
              <Text style={styles.signinText}>
                Déjà un compte ? <Text style={styles.signinLinkText}>Se connecter</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    paddingBottom: 100,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoWrap: {
    marginBottom: 12,
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
  },
  logo: {
    width: 120,
    height: 120,
  },
  logoSubtitle: {
    fontSize: 16,
    color: "#9ca3af",
    fontWeight: "400",
  },
  backRow: { marginBottom: 16 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  backLabel: {
    fontSize: 14,
    color: "#9ca3af",
    marginLeft: 8,
    fontWeight: "500",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
    textAlign: "center",
  },
  field: { marginBottom: 20 },
  label: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  fieldError: {
    color: "#f87171",
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
    fontWeight: "500",
  },
  eyeBtn: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 40,
  },
  submitWrap: { marginTop: 8, marginBottom: 24 },
  gradientButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  signinLink: { alignItems: "center", marginTop: 16 },
  signinText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  signinLinkText: {
    color: "#0ea5e9",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
