import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { IconSymbol } from "@/components/IconSymbol";

export default function TabLayoutIOS() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <IconSymbol ios_icon_name="house.fill" android_material_icon_name="home" size={24} color="#0EA5E9" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(history)">
        <IconSymbol ios_icon_name="chart.line.uptrend.xyaxis" android_material_icon_name="trending_up" size={24} color="#0EA5E9" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <IconSymbol ios_icon_name="gearshape.fill" android_material_icon_name="settings" size={24} color="#0EA5E9" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
