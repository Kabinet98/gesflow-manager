#!/bin/bash

# Script pour lancer le serveur de développement avec l'IP locale automatiquement

# Obtenir l'IP locale (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
else
  IP="localhost"
fi

# Si aucune IP n'est trouvée, utiliser localhost
if [ -z "$IP" ] || [ "$IP" == "" ]; then
  IP="localhost"
fi

echo "🚀 Démarrage du serveur de développement..."
echo "📍 IP locale détectée: $IP"
echo "🔗 URL du serveur: exp://$IP:8081"
echo ""
echo "💡 Dans l'app development build, entrez: exp://$IP:8081"
echo ""

# Lancer le serveur avec l'IP
EXPO_DEV_SERVER_URL="http://$IP:8081" expo start --dev-client --lan
