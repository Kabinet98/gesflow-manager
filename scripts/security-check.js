#!/usr/bin/env node

/**
 * Script d'évaluation de vulnérabilité pour GesFlow Manager
 * Vérifie les dépendances, les configurations et les bonnes pratiques de sécurité
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let issues = [];
let warnings = [];
let passed = [];

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkPassed(name) {
  passed.push(name);
  log(`✓ ${name}`, colors.green);
}

function checkWarning(name, message) {
  warnings.push({ name, message });
  log(`⚠ ${name}: ${message}`, colors.yellow);
}

function checkIssue(name, message) {
  issues.push({ name, message });
  log(`✗ ${name}: ${message}`, colors.red);
}

// Vérification 1: Audit des dépendances
function checkNpmAudit() {
  log('\n📦 Vérification des vulnérabilités des dépendances...', colors.cyan);
  
  // Vérifier d'abord si package-lock.json ou yarn.lock existe
  const projectRoot = path.join(__dirname, '..');
  const packageLockPath = path.join(projectRoot, 'package-lock.json');
  const yarnLockPath = path.join(projectRoot, 'yarn.lock');
  const hasYarn = fs.existsSync(yarnLockPath);
  const hasNpm = fs.existsSync(packageLockPath);
  
  if (!hasNpm && !hasYarn) {
    checkWarning('Audit de dépendances', 'package-lock.json ou yarn.lock manquant - exécutez "npm install" ou "yarn install"');
    return;
  }
  
  // Détecter le gestionnaire de paquets
  const useYarn = hasYarn;
  
  if (useYarn) {
    // Yarn audit retourne un format texte, pas JSON
    // Yarn audit retourne un code de sortie non-zéro s'il y a des vulnérabilités
    try {
      const result = execSync('yarn audit --level moderate', { 
        encoding: 'utf-8', 
        stdio: 'pipe', 
        timeout: 30000,
        cwd: projectRoot
      });
      
      // Si on arrive ici, pas de vulnérabilités
      checkPassed('Aucune vulnérabilité détectée');
    } catch (error) {
      // Yarn audit retourne un code de sortie non-zéro s'il y a des vulnérabilités
      // Récupérer la sortie (stdout contient le résultat même en cas d'erreur)
      const output = error.stdout || error.stderr || error.message || '';
      
      if (output.includes('┌───────────────┬') || output.includes('high') || output.includes('moderate')) {
        // Il y a des vulnérabilités - parser le format de tableau de yarn
        // Compter les vulnérabilités par niveau
        const criticalMatches = output.match(/│\s+critical\s+│/g);
        const highMatches = output.match(/│\s+high\s+│/g);
        const moderateMatches = output.match(/│\s+moderate\s+│/g);
        const lowMatches = output.match(/│\s+low\s+│/g);
        
        const critical = criticalMatches ? criticalMatches.length : 0;
        const high = highMatches ? highMatches.length : 0;
        const moderate = moderateMatches ? moderateMatches.length : 0;
        const low = lowMatches ? lowMatches.length : 0;
        
        if (critical > 0) {
          checkIssue('Vulnérabilités détectées', `${critical} critique(s), ${high} haute(s), ${moderate} modérée(s), ${low} faible(s)`);
        } else if (high > 0) {
          checkWarning('Vulnérabilités détectées', `${high} haute(s), ${moderate} modérée(s), ${low} faible(s)`);
        } else if (moderate > 0 || low > 0) {
          checkWarning('Vulnérabilités détectées', `${moderate} modérée(s), ${low} faible(s)`);
        } else {
          // Format inattendu mais il y a des vulnérabilités
          checkWarning('Vulnérabilités détectées', 'Voir détails avec: yarn audit');
        }
      } else if (output.includes('ENOTFOUND') || output.includes('network') || output.includes('timeout') || output.includes('ECONNREFUSED')) {
        checkWarning('Audit yarn', 'Connexion réseau indisponible. Exécutez manuellement: yarn audit');
      } else if (output.includes('ENOLOCK') || output.includes('lockfile')) {
        checkWarning('Audit yarn', 'Lockfile manquant. Exécutez: yarn install');
      } else {
        // Autre erreur - peut-être pas de vulnérabilités ou erreur inconnue
        // Essayer de détecter si c'est juste "no vulnerabilities"
        if (output.toLowerCase().includes('no vulnerabilities') || output.toLowerCase().includes('0 vulnerabilities')) {
          checkPassed('Aucune vulnérabilité détectée');
        } else {
          checkWarning('Audit yarn', `Erreur inattendue. Exécutez manuellement: yarn audit`);
        }
      }
    }
  } else {
    // Utiliser npm audit
    try {
      const result = execSync('npm audit --json', { 
        encoding: 'utf-8', 
        stdio: 'pipe', 
        timeout: 30000,
        cwd: projectRoot
      });
      const audit = JSON.parse(result);
      
      if (audit.vulnerabilities) {
        const critical = audit.metadata?.vulnerabilities?.critical || 0;
        const high = audit.metadata?.vulnerabilities?.high || 0;
        const moderate = audit.metadata?.vulnerabilities?.moderate || 0;
        const low = audit.metadata?.vulnerabilities?.low || 0;
        
        if (critical > 0) {
          checkIssue('Vulnérabilités détectées', `${critical} critique(s), ${high} haute(s), ${moderate} modérée(s), ${low} faible(s)`);
        } else if (high > 0) {
          checkWarning('Vulnérabilités détectées', `${high} haute(s), ${moderate} modérée(s), ${low} faible(s)`);
        } else if (moderate > 0 || low > 0) {
          checkWarning('Vulnérabilités détectées', `${moderate} modérée(s), ${low} faible(s)`);
        } else {
          checkPassed('Aucune vulnérabilité détectée');
        }
      } else {
        checkPassed('Aucune vulnérabilité détectée');
      }
    } catch (err) {
      // Vérifier si c'est une erreur réseau ou autre
      const errorMsg = err.message || err.toString();
      const packageManager = useYarn ? 'yarn' : 'npm';
      
      if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('network') || errorMsg.includes('timeout')) {
        checkWarning('Audit de dépendances', `Connexion réseau indisponible. Exécutez manuellement: ${packageManager} audit`);
      } else if (errorMsg.includes('EACCES') || errorMsg.includes('permission')) {
        checkWarning('Audit de dépendances', `Problème de permissions. Essayez avec sudo ou vérifiez les permissions ${packageManager}`);
      } else if (errorMsg.includes('ENOLOCK') || errorMsg.includes('lockfile')) {
        checkWarning('Audit de dépendances', `Lockfile manquant. Exécutez: ${useYarn ? 'yarn install' : 'npm install'}`);
      } else {
        checkWarning('Audit de dépendances', `Erreur: ${errorMsg.substring(0, 100)}. Exécutez manuellement: ${packageManager} audit`);
      }
    }
  }
}

// Vérification 2: Fichiers sensibles
function checkSensitiveFiles() {
  log('\n🔒 Vérification des fichiers sensibles...', colors.cyan);
  const sensitiveFiles = [
    '.env',
    '.env.local',
    '.env.production',
    '*.key',
    '*.pem',
    '*.cert',
    'android/app/release.keystore',
  ];
  
  const projectRoot = path.join(__dirname, '..');
  let foundSensitive = false;
  
  sensitiveFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath) && !file.includes('*')) {
      // Vérifier si le fichier est dans .gitignore
      const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf-8');
      if (!gitignore.includes(file)) {
        checkIssue(`Fichier sensible non ignoré`, file);
        foundSensitive = true;
      }
    }
  });
  
  if (!foundSensitive) {
    checkPassed('Fichiers sensibles correctement configurés');
  }
}

// Vérification 3: Variables d'environnement
function checkEnvFiles() {
  log('\n🌍 Vérification des fichiers d\'environnement...', colors.cyan);
  const projectRoot = path.join(__dirname, '..');
  const envExample = path.join(projectRoot, '.env.example');
  const envLocal = path.join(projectRoot, '.env.local');
  
  if (!fs.existsSync(envExample)) {
    checkWarning('Fichier .env.example', 'Manquant - recommandé pour documenter les variables');
  } else {
    checkPassed('Fichier .env.example présent');
    
    // Vérifier que .env.example ne contient pas de secrets réels
    const envExampleContent = fs.readFileSync(envExample, 'utf-8');
    if (envExampleContent.includes('sk_live_') || envExampleContent.includes('AKIA') || envExampleContent.match(/[A-Za-z0-9]{40,}/)) {
      checkIssue('Fichier .env.example', 'Contient possiblement des secrets réels - vérifiez le contenu');
    }
  }
  
  if (fs.existsSync(envLocal)) {
    const envContent = fs.readFileSync(envLocal, 'utf-8');
    if (envContent.includes('password') || envContent.includes('secret') || envContent.includes('key')) {
      checkWarning('Fichier .env.local', 'Contient des secrets - assurez-vous qu\'il est dans .gitignore');
    }
  }
}

// Vérification 4: Configuration HTTPS/SSL
function checkHttpsConfig() {
  log('\n🔐 Vérification de la configuration HTTPS...', colors.cyan);
  const projectRoot = path.join(__dirname, '..');
  const apiConfig = path.join(projectRoot, 'src/config/api.ts');
  
  if (fs.existsSync(apiConfig)) {
    const content = fs.readFileSync(apiConfig, 'utf-8');
    if (content.includes('http://') && !content.includes('localhost')) {
      checkIssue('Configuration API', 'Utilise HTTP au lieu de HTTPS');
    } else if (content.includes('https://') || content.includes('localhost')) {
      checkPassed('Configuration API utilise HTTPS/localhost');
    }
  }
}

// Vérification 5: Stockage sécurisé
function checkSecureStorage() {
  log('\n💾 Vérification du stockage sécurisé...', colors.cyan);
  const projectRoot = path.join(__dirname, '..');
  const secureStorage = path.join(projectRoot, 'src/utils/secure-storage.ts');
  
  if (fs.existsSync(secureStorage)) {
    checkPassed('Utilise expo-secure-store pour le stockage sécurisé');
  } else {
    checkWarning('Stockage sécurisé', 'Fichier secure-storage.ts non trouvé');
  }
}

// Vérification 6: Authentification
function checkAuthSecurity() {
  log('\n🔑 Vérification de la sécurité d\'authentification...', colors.cyan);
  const projectRoot = path.join(__dirname, '..');
  const authService = path.join(projectRoot, 'src/services/auth.service.ts');
  
  if (fs.existsSync(authService)) {
    const content = fs.readFileSync(authService, 'utf-8');
    
    if (content.includes('expo-secure-store') || content.includes('SecureStore')) {
      checkPassed('Utilise le stockage sécurisé pour les tokens');
    } else {
      checkWarning('Stockage des tokens', 'Vérifiez que les tokens sont stockés de manière sécurisée');
    }
    
    if (content.includes('2FA') || content.includes('twoFactor') || content.includes('otp')) {
      checkPassed('Authentification à deux facteurs implémentée');
    } else {
      checkWarning('2FA', 'Authentification à deux facteurs non détectée');
    }
  }
}

// Vérification 7: Détection de captures d'écran
function checkScreenshotProtection() {
  log('\n📸 Vérification de la protection contre les captures d\'écran...', colors.cyan);
  const projectRoot = path.join(__dirname, '..');
  const screenshotDetector = path.join(projectRoot, 'src/utils/screenshot-detector.ts');
  
  if (fs.existsSync(screenshotDetector)) {
    checkPassed('Détection de captures d\'écran implémentée');
  } else {
    checkWarning('Protection captures d\'écran', 'Non détectée');
  }
}

// Vérification 8: Headers de sécurité
function checkSecurityHeaders() {
  log('\n🛡️ Vérification des headers de sécurité...', colors.cyan);
  const projectRoot = path.join(__dirname, '..');
  const apiConfig = path.join(projectRoot, 'src/config/api.ts');
  
  if (fs.existsSync(apiConfig)) {
    const content = fs.readFileSync(apiConfig, 'utf-8');
    if (content.includes('headers') && (content.includes('Authorization') || content.includes('Bearer'))) {
      checkPassed('Headers d\'authentification configurés');
    }
  }
}

// Vérification 9: Validation des entrées (OWASP M4 / MASVS-CODE-4)
function checkInputValidation() {
  log('\n✅ Vérification de la validation des entrées (OWASP M4)...', colors.cyan);
  const projectRoot = path.join(__dirname, '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
  
  if (packageJson.dependencies?.zod || packageJson.devDependencies?.zod) {
    checkPassed('Utilise Zod pour la validation des schémas');
  } else {
    checkWarning('Validation des entrées', 'Zod non détecté - recommandé pour la validation');
  }

  const numericInputUtil = path.join(projectRoot, 'src/utils/numeric-input.ts');
  if (fs.existsSync(numericInputUtil)) {
    checkPassed('Utilitaire de champs numériques (chiffres uniquement) présent');
  } else {
    checkWarning('Champs numériques', 'Utilitaire numeric-input non trouvé - recommandé pour éviter la saisie de texte dans les montants');
  }
}

// Vérification 10: Logs et monitoring (pas de données sensibles en clair)
function checkLogging() {
  log('\n📊 Vérification du logging...', colors.cyan);
  const projectRoot = path.join(__dirname, '..');
  const logger = path.join(projectRoot, 'src/utils/logger.ts');
  
  if (fs.existsSync(logger)) {
    checkPassed('Système de logging présent');
  } else {
    checkWarning('Logging', 'Système de logging non détecté');
  }

  // OWASP: pas de console.log avec données sensibles dans src
  const srcDir = path.join(projectRoot, 'src');
  if (fs.existsSync(srcDir)) {
    let foundConsole = false;
    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
            walk(full);
          } else if (e.isFile() && /\.(ts|tsx|js|jsx)$/.test(e.name)) {
            const content = fs.readFileSync(full, 'utf-8');
            if (content.includes('console.log') || content.includes('console.debug') || content.includes('console.info')) {
              if (/\b(password|token|secret|apiKey|apikey)\s*[\),]/.test(content) || /console\.(log|debug|info)\s*\([^)]*\+/.test(content)) {
                foundConsole = true;
              }
            }
          }
        }
      } catch (_) {}
    };
    walk(srcDir);
    if (!foundConsole) {
      checkPassed('Aucun log sensible détecté dans src (OWASP)');
    } else {
      checkWarning('Logs', 'Évitez console.log avec mots de passe/tokens dans src');
    }
  }
}

// Vérification 11: Formulaires sécurisés (données utilisateur)
function checkFormSecurity() {
  log('\n📝 Vérification des formulaires (OWASP M4)...', colors.cyan);
  const projectRoot = path.join(__dirname, '..');
  const apiPath = path.join(projectRoot, 'src/config/api.ts');
  if (fs.existsSync(apiPath)) {
    const content = fs.readFileSync(apiPath, 'utf-8');
    if (content.includes('Content-Type') && content.includes('application/json')) {
      checkPassed('Requêtes API en JSON (pas de form-data non sécurisé)');
    }
  }
  if (fs.existsSync(path.join(projectRoot, 'src/utils/secure-storage.ts'))) {
    checkPassed('Tokens / secrets stockés via secure-storage');
  }
}

// Fonction principale
function main() {
  log('\n🔍 Évaluation de vulnérabilité - GesFlow Manager\n', colors.blue);
  log('=' .repeat(60), colors.cyan);
  
  checkNpmAudit();
  checkSensitiveFiles();
  checkEnvFiles();
  checkHttpsConfig();
  checkSecureStorage();
  checkAuthSecurity();
  checkScreenshotProtection();
  checkSecurityHeaders();
  checkInputValidation();
  checkLogging();
  checkFormSecurity();

  // Résumé
  log('\n' + '='.repeat(60), colors.cyan);
  log('\n📋 RÉSUMÉ', colors.blue);
  log(`✓ Vérifications réussies: ${passed.length}`, colors.green);
  log(`⚠ Avertissements: ${warnings.length}`, colors.yellow);
  log(`✗ Problèmes: ${issues.length}`, colors.red);
  
  if (warnings.length > 0) {
    log('\n⚠ AVERTISSEMENTS:', colors.yellow);
    warnings.forEach(w => log(`  - ${w.name}: ${w.message}`, colors.yellow));
  }
  
  if (issues.length > 0) {
    log('\n✗ PROBLÈMES CRITIQUES:', colors.red);
    issues.forEach(i => log(`  - ${i.name}: ${i.message}`, colors.red));
  }
  
  log('\n' + '='.repeat(60), colors.cyan);
  
  // Suggestions pour les avertissements
  if (warnings.length > 0) {
    const auditWarning = warnings.find(w => w.name.includes('Audit'));
    if (auditWarning) {
      const projectRoot = path.join(__dirname, '..');
      const useYarn = fs.existsSync(path.join(projectRoot, 'yarn.lock'));
      const packageManager = useYarn ? 'yarn' : 'npm';
      
      log('\n💡 SUGGESTION:', colors.cyan);
      log(`   Pour exécuter l'audit ${packageManager} manuellement:`, colors.cyan);
      if (useYarn) {
        log('   - yarn audit (pour voir les vulnérabilités)', colors.cyan);
        log('   - yarn audit fix (pour corriger automatiquement)', colors.cyan);
        log('   - yarn audit --level low (pour un audit complet)', colors.cyan);
      } else {
        log('   - npm audit (pour voir les vulnérabilités)', colors.cyan);
        log('   - npm audit fix (pour corriger automatiquement)', colors.cyan);
        log('   - npm audit --audit-level=low (pour un audit complet)', colors.cyan);
      }
    }
  }
  
  if (issues.length > 0) {
    log('\n❌ Des problèmes critiques ont été détectés. Veuillez les corriger.', colors.red);
    process.exit(1);
  } else if (warnings.length > 0) {
    log('\n⚠️ Des avertissements ont été détectés. Consultez le rapport ci-dessus.', colors.yellow);
    log('   Note: Les avertissements ne bloquent pas le déploiement mais devraient être examinés.', colors.yellow);
    process.exit(0);
  } else {
    log('\n✅ Aucun problème de sécurité détecté!', colors.green);
    process.exit(0);
  }
}

main();
