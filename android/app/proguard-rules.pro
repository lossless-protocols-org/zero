# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ==========================================
# React Native
# ==========================================
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip
-keep,allowobfuscation @interface com.facebook.jni.annotations.DoNotStrip

# Do not strip any method/class that is annotated with @DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep @com.facebook.common.internal.DoNotStrip class *
-keep @com.facebook.jni.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
    @com.facebook.jni.annotations.DoNotStrip *;
}

-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
  void set*(***);
  *** get*();
}

-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers,includedescriptorclasses class * { native <methods>; }
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ==========================================
# Native libraries (audited 2026-11-08 for R8 in 2.8; narrowed by the
# principal audit the same day, §6.3)
#
# Only libraries that ship NO consumer rules are kept here. These carry their
# own (merged from the AAR), so a keep here would only duplicate them:
#   reanimated  -keep com.swmansion.reanimated.**, react.turbomodule.**, react.fabric.**
#   worklets    -keep com.swmansion.worklets.**, react.turbomodule.**, react.fabric.**
#   svg         -keep com.horcrux.svg.**
#   screens     -keepnames its Fragments (what it restores by name)
# zero's own code needs no keep: manifest components (widget provider,
# quick-add activity, tile) are kept by AAPT's generated rules, the widget
# TurboModule by the NativeModule rule above, and nothing is reached by
# reflection. Stack traces read through the archived mapping.txt
# (scripts/archive-symbols.sh, uploaded to Play with each release).
# ==========================================
# WatermelonDB: JSI installer and adapter are called from C++ / reflection.
-keep class com.nozbe.watermelondb.** { *; }
# Gesture handler, safe area: view managers and JNI hooks, no consumer rules.
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
# Nitro modules + MMKV (v4 is a Nitro module): HybridObjects are created
# from C++ through JNI by class name.
-keep class com.margelo.nitro.** { *; }
# Other native modules without consumer rules.
-keep class com.reactcommunity.rndatetimepicker.** { *; }
-keep class com.reactnativedocumentpicker.** { *; }
-keep class com.rnfs.** { *; }
-keep class com.zoontek.rnlocalize.** { *; }
-keep class org.linusu.** { *; }

# ==========================================
# Keep JavaScript interface methods
# ==========================================
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-dontusemixedcaseclassnames

# ==========================================
# Remove logging in release
# ==========================================
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# ==========================================
# Keep source file names for crash reports
# ==========================================
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
