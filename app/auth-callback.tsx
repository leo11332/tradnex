import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/auth";

type Status = "processing" | "success" | "error";

export default function AuthCallbackScreen() {
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Supabase handles the hash/query params automatically on web
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setStatus("error");
        setMessage(`Authentication failed: ${error.message}`);
        window.opener?.postMessage(
          { type: "oauth-error", error: error.message },
          window.location.origin
        );
        return;
      }

      if (data.session) {
        setStatus("success");
        setMessage("Authentication successful! Closing...");
        window.opener?.postMessage(
          { type: "oauth-success", token: data.session.access_token },
          window.location.origin
        );
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            router.replace("/(tabs)/(home)");
          }
        }, 1000);
      } else {
        // No session yet — might be a hash fragment that Supabase is processing
        setTimeout(async () => {
          const { data: retryData } = await supabase.auth.getSession();
          if (retryData.session) {
            setStatus("success");
            setMessage("Authentication successful!");
            window.opener?.postMessage(
              { type: "oauth-success", token: retryData.session.access_token },
              window.location.origin
            );
            setTimeout(() => {
              if (window.opener) window.close();
              else router.replace("/(tabs)/(home)");
            }, 800);
          } else {
            setStatus("error");
            setMessage("No session received");
            window.opener?.postMessage(
              { type: "oauth-error", error: "No session" },
              window.location.origin
            );
          }
        }, 1500);
      }
    } catch (err) {
      setStatus("error");
      setMessage("Failed to process authentication");
      console.error("Auth callback error:", err);
    }
  };

  return (
    <View style={styles.container}>
      {status === "processing" && (
        <ActivityIndicator size="large" color="#0EA5E9" />
      )}
      {status === "success" && <Text style={styles.successIcon}>✓</Text>}
      {status === "error" && <Text style={styles.errorIcon}>✗</Text>}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#080B0F",
  },
  successIcon: { fontSize: 48, color: "#34C759" },
  errorIcon: { fontSize: 48, color: "#FF3B30" },
  message: {
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
    color: "#F0F4F8",
  },
});
