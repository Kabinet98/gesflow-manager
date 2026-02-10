#!/bin/bash

# Script pour construire et installer le build de développement Android

set -e

echo "🔨 Construction du build de développement Android..."
echo ""

# Vérifier si adb est disponible
if command -v adb &> /dev/null; then
    ADB_CMD="adb"
elif [ -f "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
    ADB_CMD="$HOME/Library/Android/sdk/platform-tools/adb"
else
    echo "⚠️  adb non trouvé. Assurez-vous qu'Android SDK Platform-Tools est installé."
    echo "   Vous pouvez continuer, mais la vérification des appareils sera ignorée."
    ADB_CMD=""
fi

# Vérifier les appareils connectés
if [ -n "$ADB_CMD" ]; then
    echo "📱 Vérification des appareils connectés..."
    DEVICES=$($ADB_CMD devices | grep -v "List" | grep "device$" | wc -l | tr -d ' ')
    
    if [ "$DEVICES" -eq 0 ]; then
        echo "⚠️  Aucun appareil Android détecté!"
        echo ""
        echo "Options:"
        echo "  1. Démarrez un émulateur depuis Android Studio"
        echo "  2. Connectez un appareil physique avec USB debugging activé"
        echo ""
        read -p "Continuer quand même? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo "✅ $DEVICES appareil(s) détecté(s)"
        $ADB_CMD devices
        echo ""
    fi
fi

# Construire et installer
echo "🚀 Lancement de la construction..."
echo "   (Cela peut prendre plusieurs minutes la première fois)"
echo ""

expo run:android

echo ""
echo "✅ Build terminé!"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Dans un autre terminal, lancez: yarn start:dev"
echo "   2. L'app devrait se connecter automatiquement au serveur Metro"
echo "   3. Si ce n'est pas le cas, scannez le QR code affiché"
echo ""
