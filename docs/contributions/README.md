# Contributions — Documentation des fonctionnalités

Ce dossier contient la documentation des fonctionnalités développées par les agents. Chaque agent qui termine une tâche significative doit créer un fichier ici pour documenter son travail.

## Comment contribuer

1. Copiez `_TEMPLATE.md` dans un nouveau fichier nommé de manière descriptive (ex: `kyc-status-calcul.md`, `games-logistics-flights.md`).
2. Remplissez toutes les sections pertinentes.
3. Soyez concis mais précis — l'objectif est qu'un autre agent puisse comprendre ce qui a été fait sans relire tout le code.

## Conventions de nommage

- Utilisez des noms en kebab-case : `feature-name.md`
- Préfixez par le domaine si pertinent : `athletes-kyc.md`, `games-selections.md`, `logistics-flights.md`
- Évitez les dates dans le nom (la date est dans le fichier).

## Fichiers existants

_(Cette section sera mise à jour au fil des contributions)_

| Fichier | Description |
|---------|-------------|
| `_TEMPLATE.md` | Modèle à copier pour documenter une nouvelle fonctionnalité |
| `audit-incoherences-persons-legacy.md` | Audit des incohérences : architecture hybride persons/legacy, dual-write, sync photos, navigation croisée |
| `forms-harmonization.md` | Harmonisation des formulaires : RHF + Zod, dual-write centralisé, composants réutilisables, suppression dialog legacy coach |