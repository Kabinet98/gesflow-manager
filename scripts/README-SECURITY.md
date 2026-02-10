# 🔒 Guide d'Utilisation - Évaluation de Vulnérabilité

Ce guide explique comment utiliser les outils d'évaluation de vulnérabilité pour GesFlow Manager.

## 📋 Scripts Disponibles

### 1. Audit npm

```bash
# Audit des vulnérabilités (niveau modéré et supérieur)
npm run security:audit

# Audit complet (tous les niveaux)
npm run security:audit:full

# Corriger automatiquement les vulnérabilités
npm run security:audit:fix
```

### 2. Vérification Complète

```bash
# Exécute toutes les vérifications de sécurité
npm run security:check
```

Ce script vérifie :
- ✅ Vulnérabilités npm
- ✅ Fichiers sensibles
- ✅ Configuration des variables d'environnement
- ✅ Configuration HTTPS
- ✅ Stockage sécurisé
- ✅ Authentification
- ✅ Protection contre les captures d'écran
- ✅ Headers de sécurité
- ✅ Validation des entrées
- ✅ Système de logging

### 3. Rapport de Sécurité

```bash
# Génère un rapport détaillé au format Markdown
npm run security:report
```

Le rapport est sauvegardé dans `security-report.md`.

## 🚀 Utilisation Recommandée

### Avant chaque commit

```bash
npm run security:check
```

### Avant chaque déploiement

```bash
# 1. Audit complet
npm run security:audit:full

# 2. Vérification complète
npm run security:check

# 3. Générer le rapport
npm run security:report

# 4. Corriger les vulnérabilités si nécessaire
npm run security:audit:fix
```

### Intégration CI/CD

Ajoutez ces commandes à votre pipeline CI/CD :

```yaml
# Exemple pour GitHub Actions
- name: Security Audit
  run: npm run security:audit

- name: Security Check
  run: npm run security:check
```

## 📊 Interprétation des Résultats

### ✅ Vérifications réussies
Aucune action requise.

### ⚠️ Avertissements
À examiner mais ne bloquent pas le déploiement :
- Vulnérabilités faibles/modérées
- Fichiers manquants (non critiques)
- Configurations non optimales

### ✗ Problèmes critiques
**DOIVENT être corrigés avant le déploiement** :
- Vulnérabilités critiques/hautes
- Fichiers sensibles exposés
- Configuration HTTPS manquante

## 🔧 Dépannage

### npm audit échoue

Si `npm audit` échoue, vérifiez :
1. Votre connexion internet
2. Le registre npm est accessible
3. Les permissions du fichier `package-lock.json`

Solution alternative :
```bash
npm audit --registry=https://registry.npmjs.org/
```

### Scripts non exécutables

```bash
chmod +x scripts/security-check.js
chmod +x scripts/security-report.js
```

## 📚 Documentation Complète

Consultez `SECURITY.md` pour :
- Les mesures de sécurité implémentées
- Les bonnes pratiques
- La réponse aux incidents
- Les ressources supplémentaires

---

**Note:** Exécutez ces vérifications régulièrement, idéalement avant chaque commit et déploiement.
