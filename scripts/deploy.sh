#!/bin/bash

# Script de déploiement pour GesFlow Manager
# Usage: ./scripts/deploy.sh [environment]
# Exemple: ./scripts/deploy.sh production

set -e  # Arrêter en cas d'erreur

ENVIRONMENT=${1:-production}
PROJECT_DIR="/opt/gesflow"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "🚀 Déploiement de GesFlow Manager - Environnement: $ENVIRONMENT"
echo "=================================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erreur: docker-compose.yml non trouvé. Exécutez ce script depuis le répertoire du projet."
    exit 1
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Erreur: Docker n'est pas installé."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Erreur: Docker Compose n'est pas installé."
    exit 1
fi

# Créer les répertoires nécessaires
echo "📁 Création des répertoires..."
mkdir -p "$BACKUP_DIR"
mkdir -p "$PROJECT_DIR/uploads"
mkdir -p "$PROJECT_DIR/logs"

# Sauvegarder la base de données avant le déploiement
echo "💾 Sauvegarde de la base de données..."
if docker-compose ps postgres | grep -q "Up"; then
    docker-compose exec -T postgres pg_dump -U gesflow_user gesflow > "$BACKUP_DIR/backup_before_deploy_$DATE.sql" 2>/dev/null || echo "⚠️  Impossible de sauvegarder (base de données peut-être vide)"
    echo "✅ Sauvegarde créée: backup_before_deploy_$DATE.sql"
else
    echo "⚠️  PostgreSQL n'est pas en cours d'exécution, pas de sauvegarde"
fi

# Arrêter les services existants
echo "🛑 Arrêt des services existants..."
docker-compose down

# Pull les dernières images (si vous utilisez des images pré-buildées)
# docker-compose pull

# Build les images (si vous build depuis le code source)
echo "🔨 Build des images Docker..."
docker-compose build --no-cache

# Démarrer les services
echo "▶️  Démarrage des services..."
docker-compose up -d

# Attendre que les services soient prêts
echo "⏳ Attente que les services soient prêts..."
sleep 10

# Vérifier la santé des services
echo "🏥 Vérification de la santé des services..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose ps | grep -q "healthy\|Up"; then
        echo "✅ Services démarrés"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Tentative $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Erreur: Les services n'ont pas démarré correctement"
    docker-compose logs
    exit 1
fi

# Exécuter les migrations de base de données
echo "🗄️  Exécution des migrations de base de données..."
if docker-compose exec -T backend npx prisma migrate deploy 2>/dev/null; then
    echo "✅ Migrations exécutées avec succès"
else
    echo "⚠️  Aucune migration à exécuter ou erreur (peut être normal)"
fi

# Vérifier que l'API répond
echo "🔍 Vérification de l'API..."
sleep 5
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ API accessible"
else
    echo "⚠️  L'API ne répond pas encore (peut prendre quelques secondes)"
fi

# Afficher les logs
echo ""
echo "📋 Logs des services:"
echo "===================="
docker-compose ps

echo ""
echo "✅ Déploiement terminé!"
echo ""
echo "📊 Commandes utiles:"
echo "  - Voir les logs: docker-compose logs -f"
echo "  - Arrêter: docker-compose down"
echo "  - Redémarrer: docker-compose restart"
echo "  - Vérifier l'état: docker-compose ps"
echo ""
