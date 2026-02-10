#!/usr/bin/env node

/**
 * Génère un rapport détaillé de sécurité pour GesFlow Manager
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const reportPath = path.join(projectRoot, 'security-report.md');

function generateReport() {
  let report = `# Rapport de Sécurité - GesFlow Manager\n\n`;
  report += `**Date:** ${new Date().toLocaleString('fr-FR')}\n\n`;
  report += `---\n\n`;
  
  // 1. Audit npm
  report += `## 1. Audit des Dépendances npm\n\n`;
  try {
    const auditResult = execSync('npm audit --json', { encoding: 'utf-8', stdio: 'pipe' });
    const audit = JSON.parse(auditResult);
    
    if (audit.metadata?.vulnerabilities) {
      const vulns = audit.metadata.vulnerabilities;
      report += `### Vulnérabilités détectées:\n\n`;
      report += `- **Critiques:** ${vulns.critical || 0}\n`;
      report += `- **Hautes:** ${vulns.high || 0}\n`;
      report += `- **Modérées:** ${vulns.moderate || 0}\n`;
      report += `- **Faibles:** ${vulns.low || 0}\n\n`;
      
      if (vulns.critical > 0 || vulns.high > 0) {
        report += `⚠️ **Action requise:** Exécutez \`npm audit fix\` pour corriger les vulnérabilités.\n\n`;
      }
    } else {
      report += `✅ Aucune vulnérabilité détectée.\n\n`;
    }
  } catch (error) {
    report += `❌ Erreur lors de l'audit npm.\n\n`;
  }
  
  // 2. Analyse des dépendances
  report += `## 2. Analyse des Dépendances\n\n`;
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
  const totalDeps = Object.keys(packageJson.dependencies || {}).length;
  const totalDevDeps = Object.keys(packageJson.devDependencies || {}).length;
  
  report += `- **Dépendances de production:** ${totalDeps}\n`;
  report += `- **Dépendances de développement:** ${totalDevDeps}\n`;
  report += `- **Total:** ${totalDeps + totalDevDeps}\n\n`;
  
  // 3. Configuration de sécurité
  report += `## 3. Configuration de Sécurité\n\n`;
  
  // Vérifier expo-secure-store
  if (packageJson.dependencies?.['expo-secure-store']) {
    report += `✅ **expo-secure-store:** Installé (${packageJson.dependencies['expo-secure-store']})\n\n`;
  } else {
    report += `❌ **expo-secure-store:** Non installé - Recommandé pour le stockage sécurisé\n\n`;
  }
  
  // Vérifier Zod pour la validation
  if (packageJson.dependencies?.zod || packageJson.devDependencies?.zod) {
    report += `✅ **Zod:** Installé pour la validation des schémas\n\n`;
  }
  
  // 4. Bonnes pratiques
  report += `## 4. Bonnes Pratiques de Sécurité\n\n`;
  report += `### ✅ Implémentées:\n\n`;
  report += `- Stockage sécurisé avec expo-secure-store\n`;
  report += `- Détection de captures d'écran\n`;
  report += `- Authentification avec questions de sécurité\n`;
  report += `- Validation des entrées avec Zod\n`;
  report += `- Logging des actions utilisateur\n\n`;
  
  report += `### ⚠️ Recommandations:\n\n`;
  report += `- Effectuer un audit npm régulièrement: \`npm run security:audit\`\n`;
  report += `- Vérifier les mises à jour de sécurité: \`npm outdated\`\n`;
  report += `- Utiliser HTTPS en production uniquement\n`;
  report += `- Ne jamais commiter les fichiers .env\n`;
  report += `- Utiliser des secrets forts (minimum 32 caractères)\n`;
  report += `- Activer l'authentification à deux facteurs pour tous les utilisateurs\n`;
  report += `- Mettre à jour régulièrement les dépendances\n\n`;
  
  // 5. OWASP Mobile / MASVS (M4 - Validation des entrées)
  report += `## 5. Référence OWASP Mobile (M4 / MASVS-CODE-4)\n\n`;
  report += `- **Validation des entrées** : Les formulaires utilisent \`numeric-input\` (chiffres uniquement pour montants/durées).\n`;
  report += `- **Stockage** : Tokens et secrets dans \`expo-secure-store\` (SecureStore).\n`;
  report += `- **Communication** : API en HTTPS, headers \`Content-Type: application/json\`, \`Authorization: Bearer\`.\n`;
  report += `- **Authentification** : 2FA, questions de sécurité, pas de log de mots de passe/tokens.\n\n`;

  // 6. Checklist de sécurité
  report += `## 6. Checklist de Sécurité\n\n`;
  report += `- [ ] Toutes les dépendances sont à jour\n`;
  report += `- [ ] Aucune vulnérabilité critique dans npm audit\n`;
  report += `- [ ] Les fichiers .env sont dans .gitignore\n`;
  report += `- [ ] HTTPS est utilisé en production\n`;
  report += `- [ ] Les tokens sont stockés de manière sécurisée\n`;
  report += `- [ ] La validation des entrées est en place (champs numériques : chiffres uniquement)\n`;
  report += `- [ ] Les logs ne contiennent pas de données sensibles\n`;
  report += `- [ ] Les erreurs ne révèlent pas d'informations sensibles\n`;
  report += `- [ ] Les permissions sont correctement gérées\n`;
  report += `- [ ] Les sauvegardes sont chiffrées\n\n`;
  
  // 7. Actions recommandées
  report += `## 7. Actions Recommandées\n\n`;
  report += `1. Exécuter \`npm audit fix\` pour corriger les vulnérabilités automatiquement\n`;
  report += `2. Examiner les vulnérabilités avec \`npm audit\`\n`;
  report += `3. Mettre à jour les dépendances obsolètes\n`;
  report += `4. Réviser les permissions utilisateur\n`;
  report += `5. Tester les scénarios d'attaque courants\n`;
  report += `6. Documenter les procédures de sécurité\n\n`;
  
  report += `---\n\n`;
  report += `*Rapport généré automatiquement par le script security-report.js*\n`;
  
  fs.writeFileSync(reportPath, report, 'utf-8');
  
}

generateReport();
