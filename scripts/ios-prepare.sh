#!/bin/bash
# iOS projesini hazırlar: Capacitor projesi, ikon ve açılış ekranı, Info.plist ayarları, web dosyaları.
# Ortam değişkenleri (isteğe bağlı): APP_VERSION (ör. 0.1.0), BUILD_NUMBER
set -euo pipefail

npm ci
npx cap add ios

# ikon ve açılış ekranı
A=ios/App/App/Assets.xcassets
for f in $A/AppIcon.appiconset/*.png; do W=$(sips -g pixelWidth "$f" | tail -1 | awk '{print $2}'); sips -z $W $W store/icon-1024.png --out "$f" >/dev/null; done
for f in $A/Splash.imageset/*.png; do W=$(sips -g pixelWidth "$f" | tail -1 | awk '{print $2}'); H=$(sips -g pixelHeight "$f" | tail -1 | awk '{print $2}'); sips -z $H $W store/splash-2732.png --out "$f" >/dev/null; done
# ikonda alfa kanalı olmamalı (App Store reddeder)
for f in $A/AppIcon.appiconset/*.png; do sips -s format jpeg "$f" --out /tmp/i.jpg >/dev/null && sips -s format png /tmp/i.jpg --out "$f" >/dev/null; done

# yalnızca iPhone (iPad'de iPhone uyumluluk modunda çalışır)
sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' ios/App/App.xcodeproj/project.pbxproj
grep -q 'TARGETED_DEVICE_FAMILY = 1;' ios/App/App.xcodeproj/project.pbxproj || echo 'uyarı: TARGETED_DEVICE_FAMILY bulunamadı'

# Info.plist: tam ekran, yatay, gizli durum çubuğu
PL=ios/App/App/Info.plist
PB=/usr/libexec/PlistBuddy
set_key() { $PB -c "Delete :$1" $PL 2>/dev/null || true; $PB -c "Add :$1 $2 $3" $PL; }
set_key UIStatusBarHidden bool true
set_key UIViewControllerBasedStatusBarAppearance bool false
set_key UIRequiresFullScreen bool true
for KEY in UISupportedInterfaceOrientations "UISupportedInterfaceOrientations~ipad"; do
  $PB -c "Delete :$KEY" $PL 2>/dev/null || true
  $PB -c "Add :$KEY array" $PL
  $PB -c "Add :$KEY:0 string UIInterfaceOrientationLandscapeRight" $PL
  $PB -c "Add :$KEY:1 string UIInterfaceOrientationLandscapeLeft" $PL
done
# Şifreleme beyanı: uygulama ağ kullanmıyor
set_key ITSAppUsesNonExemptEncryption bool false
[ -n "${APP_VERSION:-}" ] && set_key CFBundleShortVersionString string "$APP_VERSION"
[ -n "${BUILD_NUMBER:-}" ] && set_key CFBundleVersion string "$BUILD_NUMBER"
plutil -lint $PL

npx cap sync ios
