import React, { useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, Dimensions, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const DOT_COUNT = 3;
const BOUNCE_HEIGHT = 10;
const DOT_SIZE = 8;

export function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const wobbleAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Entrée: fade + scale du contenu
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Logo: rebond continu (scale up puis retour élastique)
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
      ])
    );
    bounce.start();

    // Logo: léger wobble (rotation amusante)
    const wobble = Animated.loop(
      Animated.sequence([
        Animated.timing(wobbleAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(wobbleAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    wobble.start();

    // Trois points qui bondissent en décalé (effet "typing")
    const dotLoops = dotAnims.map((anim, i) => {
      const delay = i * 160;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
          }),
        ])
      );
    });
    dotLoops.forEach((loop) => loop.start());

    return () => {
      bounce.stop();
      wobble.stop();
      dotLoops.forEach((loop) => loop.stop());
    };
  }, [fadeAnim, scaleAnim, bounceAnim, wobbleAnim, dotAnims]);

  const logoScale = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const logoRotate = wobbleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "6deg"],
  });

  return (
    <LinearGradient
      colors={["#0f172a", "#0c1222", "#0e1a2e", "#0f172a"]}
      locations={[0, 0.35, 0.7, 1]}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.logoHalo,
              {
                opacity: bounceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.45],
                }),
                transform: [
                  {
                    scale: bounceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.logoWrap,
              {
                transform: [
                  { scale: scaleAnim },
                  { scale: logoScale },
                  { rotate: logoRotate },
                ],
              },
            ]}
          >
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
        <Text style={styles.title}>GesFlow Manager</Text>
        <Text style={styles.subtitle}>Gestion financière simplifiée</Text>

        {/* Points bondissants */}
        <View style={styles.dotsWrap}>
          {dotAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -BOUNCE_HEIGHT],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    position: "relative",
    marginBottom: 24,
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  logoHalo: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#0ea5e9",
  },
  logoWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f8fafc",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#94a3b8",
    marginBottom: 32,
    letterSpacing: 0.3,
  },
  dotsWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: BOUNCE_HEIGHT + DOT_SIZE,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "#0ea5e9",
  },
});
