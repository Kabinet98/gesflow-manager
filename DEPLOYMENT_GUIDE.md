# Guide de Déploiement - GesFlow Manager

Ce guide vous accompagne dans le déploiement de votre application GesFlow Manager sur votre propre serveur avec Docker.

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Architecture de déploiement](#architecture-de-déploiement)
3. [Étape 1 : Préparation du serveur](#étape-1--préparation-du-serveur)
4. [Étape 2 : Configuration Docker pour le backend](#étape-2--configuration-docker-pour-le-backend)
5. [Étape 3 : Configuration SSL/HTTPS](#étape-3--configuration-sslhttps)
6. [Étape 4 : Configuration des variables d'environnement](#étape-4--configuration-des-variables-denvironnement)
7. [Étape 5 : Configuration CORS](#étape-5--configuration-cors)
8. [Étape 6 : Déploiement du backend](#étape-6--déploiement-du-backend)
9. [Étape 7 : Configuration de l'app mobile](#étape-7--configuration-de-lapp-mobile)
10. [Étape 8 : Build et déploiement de l'app](#étape-8--build-et-déploiement-de-lapp)
11. [Étape 9 : Vérifications post-déploiement](#étape-9--vérifications-post-déploiement)
12. [Maintenance et mises à jour](#maintenance-et-mises-à-jour)

---

## Prérequis

### Serveur
- **OS** : Ubuntu 20.04+ / Debian 11+ / CentOS 8+ (recommandé : Ubuntu 22.04 LTS)
- **RAM** : Minimum 4GB (8GB recommandé)
- **CPU** : 2+ cores
- **Disque** : 20GB+ d'espace libre
- **Accès** : SSH avec privilèges root/sudo

### Logiciels requis
- Docker 20.10+
- Docker Compose 2.0+
- Nginx (pour reverse proxy et SSL)
- Certbot (pour certificats SSL Let's Encrypt)
- Git

### Services externes
- **Domaine** : Un nom de domaine pointant vers votre serveur (ex: `api.gesflow.com`)
- **DNS** : Configuration DNS pour pointer vers l'IP de votre serveur
- **Apple Developer Account** : Pour les notifications push iOS
- **Firebase/Google Cloud** : Pour les notifications push Android (si nécessaire)

---

## Architecture de déploiement

```
┌─────────────────────────────────────────────────────────┐
│                    App Mobile (iOS/Android)               │
│                    (TestFlight / Play Store)             │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)                 │
│                    Port 80/443                           │
│                    SSL/TLS Termination                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Docker Compose Stack                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Backend    │  │  PostgreSQL  │  │    Redis     │   │
│  │  (Next.js)   │  │              │  │              │   │
│  │  Port 3000   │  │  Port 5432   │  │  Port 6379   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────┐                                       │
│  │    MinIO     │                                       │
│  │  Port 9000   │                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

---

## Étape 1 : Préparation du serveur

### 1.1 Mise à jour du système

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 1.2 Installation de Docker

```bash
# Installation de Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installation de Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Vérification
docker --version
docker-compose --version
```

### 1.3 Installation de Nginx

```bash
# Ubuntu/Debian
sudo apt install nginx -y

# CentOS/RHEL
sudo yum install nginx -y

# Démarrer Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.4 Installation de Certbot (pour SSL)

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y
```

### 1.5 Configuration du firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# firewalld (CentOS)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## Étape 2 : Configuration Docker pour le backend

### 2.1 Structure des fichiers

Créez la structure suivante sur votre serveur :

```
/opt/gesflow/
├── docker-compose.yml
├── .env
├── nginx/
│   └── nginx.conf
└── backups/
```

### 2.2 Exemple de `docker-compose.yml`

```yaml
version: '3.8'

services:
  # Backend Next.js
  backend:
    image: your-registry/gesflow-backend:latest
    # Ou build depuis le code source:
    # build:
    #   context: ./backend
    #   dockerfile: Dockerfile
    container_name: gesflow-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - CRON_SECRET=${CRON_SECRET}
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_USE_SSL=false
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - MINIO_BUCKET_NAME=${MINIO_BUCKET_NAME}
      - REDIS_URL=redis://redis:6379/0
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    depends_on:
      - postgres
      - redis
      - minio
    networks:
      - gesflow-network
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  # PostgreSQL
  postgres:
    image: postgres:15-alpine
    container_name: gesflow-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - gesflow-network
    ports:
      - "5432:5432"

  # Redis
  redis:
    image: redis:7-alpine
    container_name: gesflow-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - gesflow-network
    ports:
      - "6379:6379"

  # MinIO (Object Storage)
  minio:
    image: minio/minio:latest
    container_name: gesflow-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    networks:
      - gesflow-network
    ports:
      - "9000:9000"
      - "9001:9001"

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  gesflow-network:
    driver: bridge
```

### 2.3 Fichier `.env` pour Docker

Créez un fichier `.env` dans `/opt/gesflow/` :

```bash
# Base de données
POSTGRES_DB=gesflow
POSTGRES_USER=gesflow_user
POSTGRES_PASSWORD=CHANGEZ_MOI_AVEC_UN_MOT_DE_PASSE_FORT
DATABASE_URL=postgresql://gesflow_user:CHANGEZ_MOI_AVEC_UN_MOT_DE_PASSE_FORT@postgres:5432/gesflow?schema=public

# NextAuth
NEXTAUTH_URL=https://api.gesflow.com
NEXTAUTH_SECRET=GÉNÉREZ_UN_SECRET_ALÉATOIRE_64_CARACTÈRES

# Cron
CRON_SECRET=GÉNÉREZ_UN_SECRET_ALÉATOIRE_64_CARACTÈRES

# MinIO
MINIO_ACCESS_KEY=CHANGEZ_MOI
MINIO_SECRET_KEY=CHANGEZ_MOI_AVEC_UN_MOT_DE_PASSE_FORT
MINIO_BUCKET_NAME=gesflow-files

# Redis
REDIS_PASSWORD=CHANGEZ_MOI_AVEC_UN_MOT_DE_PASSE_FORT
REDIS_URL=redis://:CHANGEZ_MOI_AVEC_UN_MOT_DE_PASSE_FORT@redis:6379/0

# Environnement
NODE_ENV=production
```

**⚠️ IMPORTANT** : 
- Changez TOUS les mots de passe et secrets
- Utilisez des générateurs de mots de passe forts
- Ne commitez JAMAIS ce fichier `.env` dans Git

### 2.4 Génération des secrets

```bash
# Générer NEXTAUTH_SECRET (64 caractères)
openssl rand -base64 48

# Générer CRON_SECRET (64 caractères)
openssl rand -base64 48

# Générer mots de passe PostgreSQL
openssl rand -base64 32

# Générer mot de passe Redis
openssl rand -base64 32
```

---

## Étape 3 : Configuration SSL/HTTPS

### 3.1 Configuration DNS

Assurez-vous que votre domaine pointe vers l'IP de votre serveur :

```bash
# Vérifier la résolution DNS
dig api.gesflow.com
nslookup api.gesflow.com
```

### 3.2 Configuration Nginx

Créez `/etc/nginx/sites-available/gesflow-api` :

```nginx
# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name api.gesflow.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    server_name api.gesflow.com;

    # Certificats SSL (seront générés par Certbot)
    ssl_certificate /etc/letsencrypt/live/api.gesflow.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.gesflow.com/privkey.pem;

    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Taille maximale des uploads
    client_max_body_size 100M;

    # Proxy vers le backend Docker
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Logs
    access_log /var/log/nginx/gesflow-api-access.log;
    error_log /var/log/nginx/gesflow-api-error.log;
}
```

### 3.3 Activation du site Nginx

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/gesflow-api /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### 3.4 Obtention du certificat SSL

```bash
# Obtenir le certificat Let's Encrypt
sudo certbot --nginx -d api.gesflow.com

# Vérifier le renouvellement automatique
sudo certbot renew --dry-run
```

---

## Étape 4 : Configuration des variables d'environnement

### 4.1 Variables d'environnement du backend

Dans votre backend Next.js, créez un fichier `.env.production` :

```bash
# URL publique de l'API
API_BASE_URL=https://api.gesflow.com
NEXTAUTH_URL=https://api.gesflow.com

# Base de données (utilise les variables Docker)
DATABASE_URL=postgresql://gesflow_user:PASSWORD@postgres:5432/gesflow?schema=public

# Secrets (utilise les variables Docker)
NEXTAUTH_SECRET=VOTRE_SECRET_GÉNÉRÉ
CRON_SECRET=VOTRE_SECRET_GÉNÉRÉ

# MinIO (utilise les noms de services Docker)
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=VOTRE_ACCESS_KEY
MINIO_SECRET_KEY=VOTRE_SECRET_KEY
MINIO_BUCKET_NAME=gesflow-files

# Redis (utilise le nom de service Docker)
REDIS_URL=redis://:PASSWORD@redis:6379/0
REDIS_PASSWORD=VOTRE_PASSWORD

# Environnement
NODE_ENV=production
```

---

## Étape 5 : Configuration CORS

### 5.1 Configuration CORS dans Next.js

Dans votre backend Next.js, configurez CORS pour accepter les requêtes depuis votre app mobile :

```typescript
// next.config.js ou middleware.ts
export const config = {
  api: {
    responseLimit: false,
  },
}

// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Autoriser les requêtes depuis votre app mobile
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    'exp://localhost:8081', // Development
    'exp://192.168.*',      // LAN development
    'gesflow://',           // Custom scheme (si utilisé)
  ]
  
  if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  
  return response
}

export const config = {
  matcher: '/api/:path*',
}
```

**Note** : Pour la production, vous pouvez être plus permissif ou utiliser un whitelist basé sur les User-Agents de votre app.

---

## Étape 6 : Déploiement du backend

### 6.1 Cloner le code source

```bash
cd /opt/gesflow
git clone https://github.com/votre-repo/gesflow-backend.git backend
cd backend
```

### 6.2 Build de l'image Docker

```bash
# Créer un Dockerfile pour le backend
# (Assurez-vous d'avoir un Dockerfile dans votre repo backend)

# Build l'image
docker build -t gesflow-backend:latest .

# Ou utiliser docker-compose
cd /opt/gesflow
docker-compose build backend
```

### 6.3 Migration de la base de données

```bash
# Exécuter les migrations Prisma
docker-compose exec backend npx prisma migrate deploy

# Ou si vous avez un script de migration
docker-compose exec backend npm run migrate
```

### 6.4 Démarrage des services

```bash
cd /opt/gesflow
docker-compose up -d

# Vérifier les logs
docker-compose logs -f backend
```

### 6.5 Vérification

```bash
# Vérifier que tous les conteneurs sont en cours d'exécution
docker-compose ps

# Tester l'API
curl https://api.gesflow.com/api/health
```

---

## Étape 7 : Configuration de l'app mobile

### 7.1 Mise à jour de `eas.json`

Mettez à jour votre fichier `eas.json` :

```json
{
  "build": {
    "testflight": {
      "distribution": "store",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      },
      "autoIncrement": true,
      "env": {
        "API_BASE_URL": "https://api.gesflow.com",
        "NODE_ENV": "production"
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildConfiguration": "release"
      },
      "env": {
        "API_BASE_URL": "https://api.gesflow.com",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 7.2 Mise à jour de `app.config.js`

```javascript
export default {
  expo: {
    // ... autres configs
    extra: {
      API_BASE_URL: process.env.API_BASE_URL || "https://api.gesflow.com",
      eas: {
        projectId: "1bd47c80-7355-4cdc-9803-e75dec5ba910",
      }
    }
  },
};
```

---

## Étape 8 : Build et déploiement de l'app

### 8.1 Build pour TestFlight

```bash
# Build iOS pour TestFlight
eas build --profile testflight --platform ios

# Une fois le build terminé, soumettre à TestFlight
eas submit --profile testflight --platform ios
```

### 8.2 Build pour production

```bash
# Build iOS
eas build --profile production --platform ios

# Build Android
eas build --profile production --platform android

# Soumettre
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

---

## Étape 9 : Vérifications post-déploiement

### 9.1 Vérifications backend

```bash
# Santé de l'API
curl https://api.gesflow.com/api/health

# Test d'authentification
curl -X POST https://api.gesflow.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Vérifier les logs
docker-compose logs -f backend
```

### 9.2 Vérifications base de données

```bash
# Se connecter à PostgreSQL
docker-compose exec postgres psql -U gesflow_user -d gesflow

# Vérifier les tables
\dt

# Vérifier les données
SELECT COUNT(*) FROM users;
```

### 9.3 Vérifications Redis

```bash
# Se connecter à Redis
docker-compose exec redis redis-cli -a VOTRE_PASSWORD

# Tester
PING
```

### 9.4 Vérifications MinIO

```bash
# Accéder à la console MinIO
# Ouvrir http://VOTRE_IP:9001 dans le navigateur
# Identifiants : MINIO_ACCESS_KEY / MINIO_SECRET_KEY
```

### 9.5 Test depuis l'app mobile

1. Installer l'app depuis TestFlight
2. Tester la connexion
3. Tester les fonctionnalités principales
4. Vérifier les notifications push

---

## Maintenance et mises à jour

### Mise à jour du backend

```bash
cd /opt/gesflow/backend
git pull origin main
docker-compose build backend
docker-compose up -d backend
docker-compose exec backend npx prisma migrate deploy
```

### Sauvegarde de la base de données

```bash
# Créer un script de sauvegarde
cat > /opt/gesflow/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/gesflow/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U gesflow_user gesflow > "$BACKUP_DIR/backup_$DATE.sql"
# Garder seulement les 7 derniers backups
ls -t $BACKUP_DIR/backup_*.sql | tail -n +8 | xargs rm -f
EOF

chmod +x /opt/gesflow/backup.sh

# Ajouter au crontab (sauvegarde quotidienne à 2h du matin)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/gesflow/backup.sh") | crontab -
```

### Monitoring

```bash
# Surveiller les logs
docker-compose logs -f

# Surveiller les ressources
docker stats

# Surveiller l'espace disque
df -h
```

### Renouvellement SSL

Les certificats Let's Encrypt expirent après 90 jours. Le renouvellement est automatique, mais vous pouvez le tester :

```bash
sudo certbot renew --dry-run
```

---

## Checklist de déploiement

- [ ] Serveur configuré avec Docker et Nginx
- [ ] Domaine configuré et pointant vers le serveur
- [ ] Certificat SSL obtenu et configuré
- [ ] Variables d'environnement configurées
- [ ] Base de données migrée
- [ ] Backend déployé et accessible
- [ ] CORS configuré correctement
- [ ] App mobile buildée avec l'URL de production
- [ ] App soumise à TestFlight/Play Store
- [ ] Tests fonctionnels effectués
- [ ] Sauvegardes automatiques configurées
- [ ] Monitoring en place

---

## Support et dépannage

### Problèmes courants

1. **L'app ne peut pas se connecter à l'API**
   - Vérifier que l'URL dans `eas.json` est correcte
   - Vérifier les logs Nginx : `sudo tail -f /var/log/nginx/gesflow-api-error.log`
   - Vérifier les logs Docker : `docker-compose logs backend`

2. **Erreurs CORS**
   - Vérifier la configuration CORS dans le backend
   - Vérifier les headers dans les logs Nginx

3. **Base de données inaccessible**
   - Vérifier que le conteneur PostgreSQL est en cours d'exécution
   - Vérifier les variables d'environnement DATABASE_URL

4. **Certificat SSL expiré**
   - Renouveler : `sudo certbot renew`

---

## Sécurité

### Recommandations importantes

1. **Changez tous les mots de passe par défaut**
2. **Utilisez des secrets forts** (minimum 32 caractères)
3. **Limitez l'accès SSH** (utilisez des clés SSH, désactivez l'authentification par mot de passe)
4. **Configurez un firewall** (UFW ou firewalld)
5. **Mettez à jour régulièrement** le système et les conteneurs Docker
6. **Surveillez les logs** pour détecter les activités suspectes
7. **Sauvegardez régulièrement** la base de données
8. **Utilisez HTTPS partout** (jamais HTTP en production)

---

**Bon déploiement ! 🚀**
