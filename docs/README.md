# Documentation COSLxBloobiz — Plateforme de gestion sportive

Bienvenue dans la documentation du projet COSLxBloobiz, la plateforme de gestion du Comité Olympique et Sportif Luxembourgeois.

## Structure de la documentation

```
docs/
├── README.md                   ← Vous êtes ici — Index de la documentation
├── architecture.md              ← Vue d'ensemble de l'architecture technique
├── routing.md                   ← Système de routing TanStack Router et arborescence des routes
├── data-model.md                ← Modèle de données : entités BDD, relations, contraintes
├── migrations.md                 ← Système de migrations SQL : tracking, snapshots, up/down
├── auth.md                      ← Authentification Supabase, rôles utilisateurs, protection des routes
├── conventions.md               ← Conventions de code, charte graphique, règles de styling
├── components.md                ← Composants réutilisables, patterns UI, formulaires
├── deployment.md                ← Build, déploiement, variables d'environnement
└── contributions/               ← Documentation des fonctionnalités par les agents (à compléter au fil de l'eau)
    └── _TEMPLATE.md             ← Modèle à copier pour documenter une nouvelle fonctionnalité
```

## Comment utiliser cette documentation

### Pour un nouvel agent

1. **Lisez `architecture.md`** en premier pour comprendre la stack technique et la structure du projet.
2. **Consultez `routing.md`** pour comprendre comment les pages sont organisées et reliées.
3. **Référez-vous à `data-model.md`** pour comprendre les entités BDD et leurs relations avant de travailler sur une fonctionnalité métier.
4. **Consultez `auth.md`** si votre travail implique l'authentification, les permissions ou le contexte utilisateur.
5. **Suivez `conventions.md`** et `components.md` pour écrire du code conforme au projet.

### Après avoir terminé une tâche

Quand un agent complète une fonctionnalité significative, il doit la documenter dans `docs/contributions/` :

1. **Copiez `_TEMPLATE.md`** dans un nouveau fichier nommé d'après la fonctionnalité (ex: `kyc-status-calcul.md`).
2. **Remplissez les sections** : résumé, fichiers touchés, logique, dépendances, points d'attention.
3. **Soyez concis mais précis** — l'objectif est qu'un autre agent puisse comprendre ce qui a été fait sans relire tout le code.

## Aperçu rapide

- **Stack** : React 19 + TypeScript (strict), TanStack Router (file-based), TanStack Query, Tailwind CSS v4, shadcn/ui, Supabase
- **UI** : Français, charte graphique COSL (rouge #C8102E, noir, or, bleu luxembourgeois), light mode uniquement
- **Backend** : Supabase (auth, BDD PostgreSQL, storage) — client singleton dans `src/lib/supabase.ts`
- **Build** : Vite 7 avec `@tanstack/react-start`, déploiement Cloudflare (`wrangler.jsonc`)
- **Domaine** : Gestion des athlètes, fédérations, clubs, Jeux multi-sports (JO, JPEE, EYOF…), logistique, communication, KYC