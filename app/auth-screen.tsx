import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { COLORS } from "@/constants/TradnexColors";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react-native";

export default function AuthScreen() {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithApple, signInWithGoogle } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (user) {
      console.log("[Auth] User authenticated, navigating to tabs");
      router.replace("/(tabs)/(home)");
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    console.log(`[Auth] ${mode === "signin" ? "Sign in" : "Sign up"} pressed`, { email });
    try {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password, name.trim() || undefined);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
      console.error("[Auth] Auth error:", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApple = async () => {
    setError(null);
    setIsSocialLoading("apple");
    console.log("[Auth] Apple sign in pressed");
    try {
      await signInWithApple();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Apple sign in failed";
      if (!msg.includes("cancel")) setError(msg);
    } finally {
      setIsSocialLoading(null);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setIsSocialLoading("google");
    console.log("[Auth] Google sign in pressed");
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign in failed";
      setError(msg);
    } finally {
      setIsSocialLoading(null);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    console.log("[Auth] Toggled mode to", mode === "signin" ? "signup" : "signin");
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.background }} behavior="padding">
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Logo */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <Text
              style={{
                fontSize: 36,
                fontWeight: "700",
                color: COLORS.primary,
                letterSpacing: 6,
                fontFamily: "SpaceGrotesk-Bold",
              }}
            >
              TRADNEX
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: COLORS.textSecondary,
                marginTop: 8,
                textAlign: "center",
                fontFamily: "SpaceGrotesk-Regular",
                letterSpacing: 0.3,
              }}
            >
              Trade with clarity. Perform at your peak.
            </Text>
          </View>

          {/* Mode toggle */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: COLORS.surfaceSecondary,
              borderRadius: 12,
              padding: 4,
              marginBottom: 32,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            {(["signin", "signup"] as const).map((m) => {
              const isActive = mode === m;
              return (
                <AnimatedPressable
                  key={m}
                  onPress={() => { setMode(m); setError(null); }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: isActive ? COLORS.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: isActive ? "#fff" : COLORS.textSecondary,
                      fontFamily: "SpaceGrotesk-SemiBold",
                    }}
                  >
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>

          {/* Name field (signup only) */}
          {mode === "signup" && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8, fontFamily: "SpaceGrotesk-SemiBold", letterSpacing: 0.5 }}>
                FULL NAME
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: COLORS.surfaceSecondary,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: nameFocused ? COLORS.primary : COLORS.border,
                  paddingHorizontal: 16,
                  height: 52,
                  gap: 12,
                }}
              >
                <User size={18} color={nameFocused ? COLORS.primary : COLORS.textTertiary} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={COLORS.textTertiary}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  style={{ flex: 1, color: COLORS.text, fontSize: 15, fontFamily: "SpaceGrotesk-Regular" }}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          {/* Email field */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8, fontFamily: "SpaceGrotesk-SemiBold", letterSpacing: 0.5 }}>
              EMAIL
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: emailFocused ? COLORS.primary : COLORS.border,
                paddingHorizontal: 16,
                height: 52,
                gap: 12,
              }}
            >
              <Mail size={18} color={emailFocused ? COLORS.primary : COLORS.textTertiary} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={{ flex: 1, color: COLORS.text, fontSize: 15, fontFamily: "SpaceGrotesk-Regular" }}
              />
            </View>
          </View>

          {/* Password field */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8, fontFamily: "SpaceGrotesk-SemiBold", letterSpacing: 0.5 }}>
              PASSWORD
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: passwordFocused ? COLORS.primary : COLORS.border,
                paddingHorizontal: 16,
                height: 52,
                gap: 12,
              }}
            >
              <Lock size={18} color={passwordFocused ? COLORS.primary : COLORS.textTertiary} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry={!showPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                style={{ flex: 1, color: COLORS.text, fontSize: 15, fontFamily: "SpaceGrotesk-Regular" }}
              />
              <AnimatedPressable onPress={() => setShowPassword((v) => !v)}>
                {showPassword
                  ? <EyeOff size={18} color={COLORS.textTertiary} />
                  : <Eye size={18} color={COLORS.textTertiary} />
                }
              </AnimatedPressable>
            </View>
          </View>

          {/* Error */}
          {error && (
            <View
              style={{
                backgroundColor: `${COLORS.danger}15`,
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: `${COLORS.danger}30`,
              }}
            >
              <Text style={{ color: COLORS.danger, fontSize: 13, fontFamily: "SpaceGrotesk-Regular" }}>
                {error}
              </Text>
            </View>
          )}

          {/* Submit button */}
          <AnimatedPressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 14,
              height: 52,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "SpaceGrotesk-Bold", letterSpacing: 0.5 }}>
                {mode === "signin" ? "Sign In" : "Create Account"}
              </Text>
            )}
          </AnimatedPressable>

          {/* Divider */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.divider }} />
            <Text style={{ color: COLORS.textTertiary, fontSize: 12, fontFamily: "SpaceGrotesk-Regular" }}>
              or continue with
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.divider }} />
          </View>

          {/* Apple Sign In — FIRST (App Store requirement) */}
          <AnimatedPressable
            onPress={handleApple}
            disabled={isSocialLoading !== null}
            style={{
              backgroundColor: "#000",
              borderRadius: 14,
              height: 52,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              gap: 10,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          >
            {isSocialLoading === "apple" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={{ color: "#fff", fontSize: 18, lineHeight: 20 }}></Text>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "SpaceGrotesk-SemiBold" }}>
                  Continue with Apple
                </Text>
              </>
            )}
          </AnimatedPressable>

          {/* Google Sign In */}
          <AnimatedPressable
            onPress={handleGoogle}
            disabled={isSocialLoading !== null}
            style={{
              backgroundColor: COLORS.surfaceSecondary,
              borderRadius: 14,
              height: 52,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            {isSocialLoading === "google" ? (
              <ActivityIndicator color={COLORS.text} size="small" />
            ) : (
              <>
                <Text style={{ fontSize: 16 }}>G</Text>
                <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: "600", fontFamily: "SpaceGrotesk-SemiBold" }}>
                  Continue with Google
                </Text>
              </>
            )}
          </AnimatedPressable>

          {/* Toggle link */}
          <View style={{ alignItems: "center", marginTop: 28 }}>
            <AnimatedPressable onPress={toggleMode}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontFamily: "SpaceGrotesk-Regular" }}>
                {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
                <Text style={{ color: COLORS.primary, fontWeight: "600", fontFamily: "SpaceGrotesk-SemiBold" }}>
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </Text>
              </Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
