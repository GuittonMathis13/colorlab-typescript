# 🎨 ColorLab (TypeScript)

Mini-application web permettant de générer des couleurs Hex aléatoires, copier la valeur, gérer un historique et épingler des favoris.  
Une zone avancée de **dégradé HSL** permet de visualiser une transition colorimétrique et d’appliquer une **bordure dégradée animée** sur l’aperçu.

Projet entièrement développé en **TypeScript** + DOM, sans frameworks.  
Accessible & responsive.

https://guittonmathis13.github.io/colorlab-typescript/
---

## ✨ Fonctionnalités

| Fonction | Détails |
|---------|---------|
| 🎲 Génération aléatoire | Couleur Hex avec animations |
| 📋 Copier | Via Clipboard API + feedback visuel |
| 📌 Épinglage | localStorage persistant |
| 🕘 Historique | 10 dernières couleurs (clic pour recharger) |
| ♿ Badge WCAG | Calcul du contraste + Label AA/AAA/Fail |
| 🌈 Dégradé HSL | Interpolation A → B + aperçu radial + pastilles cliquables |
| 🔃 Bordure animée | Anneau en **conic-gradient** autour du preview |
| 🌓 Thème clair / sombre / auto | Persistant (store versionné) |
| ⚡ Animations | Web Animations API + ripple effect |

---

## 🧠 Stack & architecture

- **TypeScript** sans bundler complexe
- **Namespaces** ColorCore & Store → entièrement typés
- **localStorage** avec **migration de version**
- **WCAG** contrast checker
- **CSS** : radial/conic gradients, mask, responsive
- Animation via **Web Animations API**

src/
├── color-core.ts # Noyau couleur (HSL/RGB/contraste)
├── store.ts # Persistance typée + migration
└── main.ts # Logique UI + interactions + animations
dist/ (auto-généré par tsc)


---

## 🚀 Lancer le projet en local

> Requis : Node.js + npm

```bash
# Installer dépendances
npm install

# Compiler TypeScript → dist/
npx tsc

# Servir en local (ou autre serveur statique équivalent)
npx http-server -p 5173 -c=-1

Puis ouvrir :http://localhost:5173/