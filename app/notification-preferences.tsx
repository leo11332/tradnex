import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  TextInput,
  Modal,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Bell,
  Heart,
  Activity,
  Moon,
  Plus,
  Trash2,
  ChevronRight,
  Clock,
} from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";

// ─── Storage key ──────────────────────────────────────────────────────────────

const PREFS_KEY = "@tradnex_notification_prefs";

// ─── Types ────────────────────────────────────────────────────────────────────

type Metric = "stress" | "bpm" | "sleep";
type Operator = ">" | "<" | "=";
type Logic = "AND" | "OR";

interface Condition {
  metric: Metric;
  operator: Operator;
  value: number;
}

interface CustomRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: Condition[];
  logic: Logic;
}

interface NotificationPrefs {
  stress: { enabled: boolean; threshold: number; durationMinutes: number };
  bpm: { enabled: boolean; highThreshold: number; lowThreshold: number };
  sleep: { enabled: boolean; minHours: number };
  customRules: CustomRule[];
}

const DEFAULT_PREFS: NotificationPrefs = {
  stress: { enabled: true, threshold: 70, durationMinutes: 10 },
  bpm: { enabled: true, highThreshold: 100, lowThreshold: 50 },
  sleep: { enabled: true, minHours: 7 },
  customRules: [],
};

const DURATION_OPTIONS = [5, 10, 15, 30];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function metricLabel(m: Metric): string {
  if (m === "stress") return "Stress";
  if (m === "bpm") return "BPM";
  return "Sommeil";
}

function conditionSummary(c: Condition): string {
  const unit = c.metric === "sleep" ? "h" : c.metric === "bpm" ? " bpm" : "";
  return `${metricLabel(c.metric)} ${c.operator} ${c.value}${unit}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: COLORS.textTertiary,
        letterSpacing: 1.5,
        fontFamily: "SpaceGrotesk-Bold",
        marginBottom: 10,
        paddingHorizontal: 2,
      }}
    >
      {title}
    </Text>
  );
}

function Divider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: COLORS.divider,
        marginHorizontal: 0,
        marginVertical: 4,
      }}
    />
  );
}

interface AlertCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
  accentColor: string;
}

function AlertCard({
  icon,
  title,
  subtitle,
  enabled,
  onToggle,
  children,
  accentColor,
}: AlertCardProps) {
  const expandAnim = useRef(new Animated.Value(enabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: enabled ? 1 : 0,
      useNativeDriver: false,
      speed: 18,
      bounciness: 4,
    }).start();
  }, [enabled]);

  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: enabled ? `${accentColor}30` : COLORS.border,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      {/* Accent bar */}
      <View
        style={{
          height: 3,
          backgroundColor: enabled ? accentColor : COLORS.surfaceElevated,
          opacity: 0.7,
        }}
      />

      <View style={{ padding: 16 }}>
        {/* Header row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: enabled ? 12 : 0,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: enabled ? `${accentColor}18` : COLORS.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            {icon}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: COLORS.text,
                fontFamily: "SpaceGrotesk-Bold",
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: COLORS.textSecondary,
                fontFamily: "SpaceGrotesk-Regular",
                marginTop: 1,
              }}
            >
              {subtitle}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={(v) => {
              console.log(`[NotifPrefs] Alert toggle: ${title} → ${v}`);
              onToggle(v);
            }}
            trackColor={{ false: COLORS.surfaceElevated, true: accentColor }}
            thumbColor="#fff"
            ios_backgroundColor={COLORS.surfaceElevated}
          />
        </View>

        {/* Expandable content */}
        {enabled && children}
      </View>
    </View>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  accentColor: string;
  onValueChange: (v: number) => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  accentColor,
  onValueChange,
}: SliderRowProps) {
  const displayValue = step < 1 ? Number(value).toFixed(1) : String(Math.round(value));
  const valueText = displayValue + unit;

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: COLORS.textSecondary,
            fontFamily: "SpaceGrotesk-Regular",
          }}
        >
          {label}
        </Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: `${accentColor}18`,
            borderWidth: 1,
            borderColor: `${accentColor}30`,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: accentColor,
              fontFamily: "SpaceGrotesk-Bold",
              fontVariant: ["tabular-nums"],
            }}
          >
            {valueText}
          </Text>
        </View>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor={accentColor}
        maximumTrackTintColor={COLORS.surfaceElevated}
        thumbTintColor={accentColor}
        step={step}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={{ fontSize: 9, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>
          {step < 1 ? Number(min).toFixed(1) : String(min)}
        </Text>
        <Text style={{ fontSize: 9, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>
          {step < 1 ? Number(max).toFixed(1) : String(max)}
        </Text>
      </View>
    </View>
  );
}

// ─── Add Rule Modal ───────────────────────────────────────────────────────────

interface AddRuleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (rule: CustomRule) => void;
}

function AddRuleModal({ visible, onClose, onSave }: AddRuleModalProps) {
  const [name, setName] = useState("");
  const [logic, setLogic] = useState<Logic>("AND");
  const [conditions, setConditions] = useState<Condition[]>([
    { metric: "stress", operator: ">", value: 75 },
  ]);

  const METRICS: Metric[] = ["stress", "bpm", "sleep"];
  const OPERATORS: Operator[] = [">", "<", "="];

  const addCondition = () => {
    console.log("[NotifPrefs] Add condition pressed");
    setConditions((prev) => [...prev, { metric: "stress", operator: ">", value: 70 }]);
  };

  const removeCondition = (idx: number) => {
    console.log(`[NotifPrefs] Remove condition at index ${idx}`);
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx: number, patch: Partial<Condition>) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Nom requis", "Veuillez donner un nom à cette règle.");
      return;
    }
    if (!conditions.length) {
      Alert.alert("Condition requise", "Ajoutez au moins une condition.");
      return;
    }
    const rule: CustomRule = {
      id: uid(),
      name: name.trim(),
      enabled: true,
      conditions,
      logic,
    };
    console.log("[NotifPrefs] Saving custom rule:", rule);
    onSave(rule);
    setName("");
    setLogic("AND");
    setConditions([{ metric: "stress", operator: ">", value: 75 }]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Modal header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.divider,
          }}
        >
          <AnimatedPressable
            onPress={() => {
              console.log("[NotifPrefs] Add rule modal cancelled");
              onClose();
            }}
          >
            <Text
              style={{
                fontSize: 15,
                color: COLORS.textSecondary,
                fontFamily: "SpaceGrotesk-Regular",
              }}
            >
              Annuler
            </Text>
          </AnimatedPressable>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: COLORS.text,
              fontFamily: "SpaceGrotesk-Bold",
            }}
          >
            Nouvelle règle
          </Text>
          <AnimatedPressable onPress={handleSave}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: COLORS.primary,
                fontFamily: "SpaceGrotesk-Bold",
              }}
            >
              Enregistrer
            </Text>
          </AnimatedPressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Rule name */}
          <View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: COLORS.textTertiary,
                letterSpacing: 1.5,
                fontFamily: "SpaceGrotesk-Bold",
                marginBottom: 8,
              }}
            >
              NOM DE LA RÈGLE
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: Stress élevé + BPM fort"
              placeholderTextColor={COLORS.textTertiary}
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: COLORS.text,
                fontFamily: "SpaceGrotesk-Regular",
              }}
            />
          </View>

          {/* Logic selector */}
          <View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: COLORS.textTertiary,
                letterSpacing: 1.5,
                fontFamily: "SpaceGrotesk-Bold",
                marginBottom: 8,
              }}
            >
              LOGIQUE ENTRE CONDITIONS
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["AND", "OR"] as Logic[]).map((l) => {
                const isActive = logic === l;
                return (
                  <AnimatedPressable
                    key={l}
                    onPress={() => {
                      console.log(`[NotifPrefs] Logic changed to: ${l}`);
                      setLogic(l);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: isActive ? COLORS.primary : COLORS.surface,
                      borderWidth: 1,
                      borderColor: isActive ? COLORS.primary : COLORS.border,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: isActive ? "#fff" : COLORS.textSecondary,
                        fontFamily: "SpaceGrotesk-Bold",
                      }}
                    >
                      {l === "AND" ? "ET (toutes)" : "OU (au moins une)"}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>

          {/* Conditions */}
          <View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: COLORS.textTertiary,
                letterSpacing: 1.5,
                fontFamily: "SpaceGrotesk-Bold",
                marginBottom: 8,
              }}
            >
              CONDITIONS
            </Text>

            {conditions.map((cond, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: COLORS.textSecondary,
                      fontFamily: "SpaceGrotesk-Regular",
                    }}
                  >
                    Condition {idx + 1}
                  </Text>
                  {conditions.length > 1 && (
                    <AnimatedPressable onPress={() => removeCondition(idx)}>
                      <Trash2 size={15} color={COLORS.danger} />
                    </AnimatedPressable>
                  )}
                </View>

                {/* Metric picker */}
                <Text
                  style={{
                    fontSize: 11,
                    color: COLORS.textTertiary,
                    fontFamily: "SpaceGrotesk-Regular",
                    marginBottom: 6,
                  }}
                >
                  Métrique
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                  {METRICS.map((m) => {
                    const active = cond.metric === m;
                    return (
                      <AnimatedPressable
                        key={m}
                        onPress={() => {
                          console.log(`[NotifPrefs] Condition ${idx} metric → ${m}`);
                          updateCondition(idx, { metric: m });
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 7,
                          borderRadius: 8,
                          backgroundColor: active ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                          borderWidth: 1,
                          borderColor: active ? COLORS.primary : COLORS.border,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: active ? COLORS.primary : COLORS.textSecondary,
                            fontFamily: "SpaceGrotesk-SemiBold",
                          }}
                        >
                          {metricLabel(m)}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>

                {/* Operator picker */}
                <Text
                  style={{
                    fontSize: 11,
                    color: COLORS.textTertiary,
                    fontFamily: "SpaceGrotesk-Regular",
                    marginBottom: 6,
                  }}
                >
                  Opérateur
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                  {OPERATORS.map((op) => {
                    const active = cond.operator === op;
                    return (
                      <AnimatedPressable
                        key={op}
                        onPress={() => {
                          console.log(`[NotifPrefs] Condition ${idx} operator → ${op}`);
                          updateCondition(idx, { operator: op });
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 7,
                          borderRadius: 8,
                          backgroundColor: active ? COLORS.primaryMuted : COLORS.surfaceSecondary,
                          borderWidth: 1,
                          borderColor: active ? COLORS.primary : COLORS.border,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: active ? COLORS.primary : COLORS.textSecondary,
                            fontFamily: "SpaceGrotesk-Bold",
                          }}
                        >
                          {op}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>

                {/* Value slider */}
                <Text
                  style={{
                    fontSize: 11,
                    color: COLORS.textTertiary,
                    fontFamily: "SpaceGrotesk-Regular",
                    marginBottom: 4,
                  }}
                >
                  Valeur
                </Text>
                <SliderRow
                  label=""
                  value={cond.value}
                  min={cond.metric === "sleep" ? 4 : cond.metric === "bpm" ? 40 : 0}
                  max={cond.metric === "sleep" ? 10 : cond.metric === "bpm" ? 200 : 100}
                  step={cond.metric === "sleep" ? 0.5 : 1}
                  unit={cond.metric === "sleep" ? "h" : cond.metric === "bpm" ? " bpm" : ""}
                  accentColor={COLORS.primary}
                  onValueChange={(v) => updateCondition(idx, { value: v })}
                />
              </View>
            ))}

            <AnimatedPressable
              onPress={addCondition}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.primary,
                borderStyle: "dashed",
                backgroundColor: COLORS.primaryMuted,
              }}
            >
              <Plus size={16} color={COLORS.primary} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: COLORS.primary,
                  fontFamily: "SpaceGrotesk-SemiBold",
                }}
              >
                Ajouter une condition
              </Text>
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Custom Rule Card ─────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: CustomRule;
  onToggle: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
}

function RuleCard({ rule, onToggle, onDelete }: RuleCardProps) {
  const condText = rule.conditions.map(conditionSummary).join(` ${rule.logic} `);

  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: rule.enabled ? `${COLORS.primary}30` : COLORS.border,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: COLORS.text,
              fontFamily: "SpaceGrotesk-Bold",
              marginBottom: 4,
            }}
          >
            {rule.name}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: COLORS.textSecondary,
              fontFamily: "SpaceGrotesk-Regular",
              lineHeight: 16,
            }}
          >
            {condText}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 10 }}>
          <Switch
            value={rule.enabled}
            onValueChange={(v) => {
              console.log(`[NotifPrefs] Custom rule toggle: ${rule.name} → ${v}`);
              onToggle(rule.id, v);
            }}
            trackColor={{ false: COLORS.surfaceElevated, true: COLORS.primary }}
            thumbColor="#fff"
            ios_backgroundColor={COLORS.surfaceElevated}
          />
          <AnimatedPressable
            onPress={() => {
              console.log(`[NotifPrefs] Delete rule pressed: ${rule.name}`);
              Alert.alert(
                "Supprimer la règle",
                `Supprimer "${rule.name}" ?`,
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: () => {
                      console.log(`[NotifPrefs] Rule deleted: ${rule.id}`);
                      onDelete(rule.id);
                    },
                  },
                ]
              );
            }}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: `${COLORS.danger}18`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 size={14} color={COLORS.danger} />
            </View>
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [showAddRule, setShowAddRule] = useState(false);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load prefs on mount
  useEffect(() => {
    console.log("[NotifPrefs] Loading notification preferences");
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as NotificationPrefs;
          setPrefs({ ...DEFAULT_PREFS, ...parsed });
          console.log("[NotifPrefs] Loaded prefs:", parsed);
        }
      })
      .catch((e) => console.warn("[NotifPrefs] Failed to load prefs:", e))
      .finally(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
  }, []);

  // Debounced save
  const persistPrefs = useCallback((updated: NotificationPrefs) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      console.log("[NotifPrefs] Persisting prefs to AsyncStorage");
      try {
        await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(updated));
        console.log("[NotifPrefs] Prefs saved successfully");
      } catch (e) {
        console.warn("[NotifPrefs] Failed to save prefs:", e);
      } finally {
        setSaving(false);
      }
    }, 400);
  }, []);

  const updatePrefs = useCallback(
    (patch: Partial<NotificationPrefs>) => {
      setPrefs((prev) => {
        const updated = { ...prev, ...patch };
        persistPrefs(updated);
        return updated;
      });
    },
    [persistPrefs]
  );

  const handleAddRule = useCallback(
    (rule: CustomRule) => {
      setPrefs((prev) => {
        const updated = { ...prev, customRules: [...prev.customRules, rule] };
        persistPrefs(updated);
        return updated;
      });
      setShowAddRule(false);
    },
    [persistPrefs]
  );

  const handleToggleRule = useCallback(
    (id: string, v: boolean) => {
      setPrefs((prev) => {
        const updated = {
          ...prev,
          customRules: prev.customRules.map((r) =>
            r.id === id ? { ...r, enabled: v } : r
          ),
        };
        persistPrefs(updated);
        return updated;
      });
    },
    [persistPrefs]
  );

  const handleDeleteRule = useCallback(
    (id: string) => {
      setPrefs((prev) => {
        const updated = {
          ...prev,
          customRules: prev.customRules.filter((r) => r.id !== id),
        };
        persistPrefs(updated);
        return updated;
      });
    },
    [persistPrefs]
  );

  const stressColor =
    prefs.stress.threshold < 40
      ? COLORS.success
      : prefs.stress.threshold <= 70
      ? COLORS.warning
      : COLORS.danger;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: COLORS.divider,
        }}
      >
        <AnimatedPressable
          onPress={() => {
            console.log("[NotifPrefs] Back button pressed");
            router.back();
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: COLORS.surfaceSecondary,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <ChevronRight
            size={18}
            color={COLORS.text}
            style={{ transform: [{ rotate: "180deg" }] }}
          />
        </AnimatedPressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: COLORS.text,
              fontFamily: "SpaceGrotesk-Bold",
              letterSpacing: -0.3,
            }}
          >
            Alertes & Notifications
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.textSecondary,
              fontFamily: "SpaceGrotesk-Regular",
              marginTop: 1,
            }}
          >
            {saving ? "Enregistrement..." : "Paramètres personnalisés"}
          </Text>
        </View>
        <Bell size={18} color={COLORS.primary} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, gap: 0 }}>
          {/* ── Section 1: Alertes individuelles ── */}
          <SectionTitle title="ALERTES INDIVIDUELLES" />

          {/* Stress Alert */}
          <AlertCard
            icon={<Activity size={18} color={stressColor} />}
            title="Alerte Stress"
            subtitle={`Notifier si stress > ${prefs.stress.threshold} pendant ${prefs.stress.durationMinutes} min`}
            enabled={prefs.stress.enabled}
            onToggle={(v) => updatePrefs({ stress: { ...prefs.stress, enabled: v } })}
            accentColor={stressColor}
          >
            <Divider />
            <View style={{ marginTop: 12 }}>
              <SliderRow
                label="Seuil de stress"
                value={prefs.stress.threshold}
                min={0}
                max={100}
                step={1}
                unit=""
                accentColor={stressColor}
                onValueChange={(v) => {
                  console.log(`[NotifPrefs] Stress threshold → ${v}`);
                  updatePrefs({ stress: { ...prefs.stress, threshold: Math.round(v) } });
                }}
              />

              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.textSecondary,
                  fontFamily: "SpaceGrotesk-Regular",
                  marginBottom: 8,
                }}
              >
                Durée minimale
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {DURATION_OPTIONS.map((d) => {
                  const active = prefs.stress.durationMinutes === d;
                  return (
                    <AnimatedPressable
                      key={d}
                      onPress={() => {
                        console.log(`[NotifPrefs] Stress duration → ${d} min`);
                        updatePrefs({ stress: { ...prefs.stress, durationMinutes: d } });
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: active ? `${stressColor}18` : COLORS.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: active ? stressColor : COLORS.border,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: active ? stressColor : COLORS.textSecondary,
                          fontFamily: "SpaceGrotesk-Bold",
                        }}
                      >
                        {d}m
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>
          </AlertCard>

          {/* BPM Alert */}
          <AlertCard
            icon={<Heart size={18} color={COLORS.danger} />}
            title="Alerte BPM"
            subtitle={`Notifier si BPM > ${prefs.bpm.highThreshold} ou < ${prefs.bpm.lowThreshold}`}
            enabled={prefs.bpm.enabled}
            onToggle={(v) => updatePrefs({ bpm: { ...prefs.bpm, enabled: v } })}
            accentColor={COLORS.danger}
          >
            <Divider />
            <View style={{ marginTop: 12 }}>
              <SliderRow
                label="Seuil haut"
                value={prefs.bpm.highThreshold}
                min={40}
                max={200}
                step={1}
                unit=" bpm"
                accentColor={COLORS.danger}
                onValueChange={(v) => {
                  console.log(`[NotifPrefs] BPM high threshold → ${v}`);
                  updatePrefs({ bpm: { ...prefs.bpm, highThreshold: Math.round(v) } });
                }}
              />
              <SliderRow
                label="Seuil bas"
                value={prefs.bpm.lowThreshold}
                min={40}
                max={200}
                step={1}
                unit=" bpm"
                accentColor={COLORS.warning}
                onValueChange={(v) => {
                  console.log(`[NotifPrefs] BPM low threshold → ${v}`);
                  updatePrefs({ bpm: { ...prefs.bpm, lowThreshold: Math.round(v) } });
                }}
              />
            </View>
          </AlertCard>

          {/* Sleep Alert */}
          <AlertCard
            icon={<Moon size={18} color={COLORS.accent} />}
            title="Alerte Sommeil"
            subtitle={`Notifier si sommeil < ${Number(prefs.sleep.minHours).toFixed(1)}h`}
            enabled={prefs.sleep.enabled}
            onToggle={(v) => updatePrefs({ sleep: { ...prefs.sleep, enabled: v } })}
            accentColor={COLORS.accent}
          >
            <Divider />
            <View style={{ marginTop: 12 }}>
              <SliderRow
                label="Durée minimale"
                value={prefs.sleep.minHours}
                min={4}
                max={10}
                step={0.5}
                unit="h"
                accentColor={COLORS.accent}
                onValueChange={(v) => {
                  console.log(`[NotifPrefs] Sleep min hours → ${v}`);
                  updatePrefs({ sleep: { ...prefs.sleep, minHours: v } });
                }}
              />
            </View>
          </AlertCard>

          {/* ── Section 2: Alertes combinées ── */}
          <View style={{ marginTop: 8 }}>
            <SectionTitle title="ALERTES COMBINÉES" />

            {prefs.customRules.length === 0 ? (
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  padding: 24,
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: COLORS.primaryMuted,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  <Clock size={22} color={COLORS.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: COLORS.text,
                    fontFamily: "SpaceGrotesk-Bold",
                    textAlign: "center",
                    marginBottom: 4,
                  }}
                >
                  Aucune règle personnalisée
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: COLORS.textSecondary,
                    fontFamily: "SpaceGrotesk-Regular",
                    textAlign: "center",
                    lineHeight: 18,
                  }}
                >
                  Créez des alertes multi-conditions pour des scénarios de trading avancés.
                </Text>
              </View>
            ) : (
              prefs.customRules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={handleToggleRule}
                  onDelete={handleDeleteRule}
                />
              ))
            )}

            {/* Add Rule button */}
            <AnimatedPressable
              onPress={() => {
                console.log("[NotifPrefs] Add custom rule pressed");
                setShowAddRule(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.primary,
                backgroundColor: COLORS.primaryMuted,
                marginBottom: 20,
              }}
            >
              <Plus size={18} color={COLORS.primary} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: COLORS.primary,
                  fontFamily: "SpaceGrotesk-Bold",
                }}
              >
                Ajouter une règle
              </Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      </ScrollView>

      <AddRuleModal
        visible={showAddRule}
        onClose={() => setShowAddRule(false)}
        onSave={handleAddRule}
      />
    </View>
  );
}
