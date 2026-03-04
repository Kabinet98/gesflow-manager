export default {
  expo: {
    name: "GesFlow Manager",
    slug: "gesflow-manager",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/logo.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/logo.png",
      resizeMode: "contain",
      backgroundColor: "#0f172a"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.gesflow.manager",
      googleServicesFile: "./ios/GoogleService-Info.plist",
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        NSLocationWhenInUseUsageDescription: "GesFlow a besoin de votre position pour scanner les limites de vos terrains.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "GesFlow a besoin de votre position pour scanner les limites de vos terrains.",
      },
      usesAppleSignIn: false,
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/logo.png",
        backgroundColor: "#0f172a"
      },
      package: "com.gesflow.manager",
      edgeToEdgeEnabled: true,
      // Garde le champ de saisie visible quand le clavier s'ouvre
      softwareKeyboardLayoutMode: "resize",
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
        },
      },
    },
    plugins: [
      [
        "expo-notifications",
        {
          icon: "./assets/logo.png",
          color: "#0ea5e9",
          mode: "production"
        }
      ],
      "expo-secure-store",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "GesFlow a besoin de votre position pour scanner les limites de vos terrains.",
          locationAlwaysPermission: "GesFlow a besoin de votre position pour scanner les limites de vos terrains.",
          locationWhenInUsePermission: "GesFlow a besoin de votre position pour scanner les limites de vos terrains.",
        }
      ]
    ],
    // Hermes explicite pour React Native DevTools (debugging)
    jsEngine: "hermes",
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      API_BASE_URL: process.env.API_BASE_URL || "http://localhost:3000",
      eas: {
        projectId: "1bd47c80-7355-4cdc-9803-e75dec5ba910",
      }
    }
  },
};

