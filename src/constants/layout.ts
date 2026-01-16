import { Platform } from "react-native";

/**
 * Hauteur de la tabBar en bas de l'écran
 * iOS: 85px (inclut le safe area bottom)
 * Android: 70px
 */
export const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 85 : 70;

/**
 * Padding en bas recommandé pour les ScrollView/FlatList dans les écrans avec tabBar
 * Ajoute 20px supplémentaires pour un espacement confortable
 */
export const TAB_BAR_PADDING_BOTTOM = TAB_BAR_HEIGHT + 20;

/**
 * Couleur du RefreshControl (couleur bleue de l'application)
 * Utilisée pour tous les RefreshControl dans l'application
 */
export const REFRESH_CONTROL_COLOR = "#0ea5e9";



