# Fork folder-path

Ce dépôt est le fork [`jordan15/twenty`](https://github.com/jordan15/twenty) de [`twentyhq/twenty`](https://github.com/twentyhq/twenty). Il suit une **release** amont, puis rejoue par-dessus le travail propre à ce fork (champ texte « chemin de dossier », protocole `openfoldercrm://`, traductions françaises).

L’image Docker des services `server` et `worker` est taguée **`folder-path`**.

Le `README.md` à la racine est celui du projet d’origine. Ce fichier décrit uniquement l’exploitation du fork.

## Image serveur

Le fichier Compose `packages/twenty-docker/docker-compose.yml` lance `server` et `worker` avec la même image :

```text
twentycrm/twenty:${TAG}
```

Sur ce fork, `TAG` vaut `folder-path`, donc l’image à construire est `twentycrm/twenty:folder-path`.

La cible de build est `twenty` (API **et** frontend). Le mode chemin de dossier est dans le frontend. La cible `twenty-server` ne contient pas l’interface et ne convient pas à ce déploiement. La dernière cible du Dockerfile, `twenty-app-dev`, est une image de développement : ne pas l’utiliser en production.

Le build se lance **à la racine du dépôt** (le Dockerfile copie `packages/` depuis le contexte). Docker a besoin d’assez de mémoire pour la compilation du frontend (compter au moins 10 Go pour le démon).

Remplacer `2.45.0` par la version de la release alignée (`APP_VERSION` est la version annoncée par l’application) :

```bash
docker build \
  --target twenty \
  -f packages/twenty-docker/twenty/Dockerfile \
  -t twentycrm/twenty:folder-path \
  --build-arg APP_VERSION=2.45.0 \
  .
```

Dans `packages/twenty-docker/.env` :

```text
TAG=folder-path
```

## Aligner le fork sur une nouvelle release

`main` doit rester : **dernière release `twenty/vX.Y.Z` + les commits de ce fork**. Ne pas suivre `main` amont entre deux releases.

Remotes :

| Remote | Dépôt |
| --- | --- |
| `origin` | `git@github.com:jordan15/twenty.git` |
| `upstream` | `https://github.com/twentyhq/twenty.git` |

Si `upstream` n’existe pas :

```bash
git remote add upstream https://github.com/twentyhq/twenty.git
```

Sous Windows, une fois par clone :

```bash
git config core.longpaths true
```

Sans ça, `git checkout` échoue sur des chemins plus longs que la limite Windows.

### Rejouer nos commits sur la nouvelle release

```bash
git fetch upstream --tags
git checkout main

# Release sur laquelle main est basée aujourd’hui (exemple : twenty/v2.45.0)
git describe --tags --match "twenty/v*" --abbrev=0
```

Repérer la nouvelle release sur [les releases de twentyhq/twenty](https://github.com/twentyhq/twenty/releases). Le tag a la forme `twenty/vX.Y.Z`. Lire la section breaking changes avant de continuer.

```bash
git fetch upstream tag twenty/vX.Y.Z

# Ancien tag = résultat de git describe ci-dessus
git rebase --onto twenty/vX.Y.Z twenty/vANCIEN main
```

En cas de conflit, garder le code de la release et réappliquer le comportement chemin de dossier (`displayAsFolderPath`, `FolderPathDisplay`, `openfoldercrm://`, traductions `fr-FR`). Le catalogue `packages/twenty-front/src/locales/generated/fr-FR.ts` est un gros JSON généré : conserver la version de la release et y réinjecter les chaînes françaises du fork, comme dans `fr-FR.po`.

Vérifier :

```bash
git describe --tags --match "twenty/v*" --abbrev=0
git log --oneline twenty/vX.Y.Z..HEAD
```

La première commande doit afficher le nouveau tag. La seconde ne doit lister que les commits du fork.

Publier `main` sur le fork remplace l’historique de la branche (les commits rejoués ont de nouveaux identifiants) :

```bash
git push --force-with-lease origin main
```

## Mettre à jour le serveur

À faire après un build de `twentycrm/twenty:folder-path` sur le code aligné. Les volumes Postgres et le stockage local ne se suppriment pas. `ENCRYPTION_KEY`, `APP_SECRET` et le mot de passe de base restent ceux déjà en place.

1. Sauvegarder la base, depuis le répertoire qui contient le Compose (en général `packages/twenty-docker`) :

```bash
docker compose exec db pg_dump -U postgres default > "backup-avant-maj-$(date +%Y%m%d).sql"
```

Adapter l’utilisateur et le nom de base s’ils diffèrent de `PG_DATABASE_USER` / `PG_DATABASE_NAME` dans `.env`.

2. Déposer la nouvelle image sur le serveur.

Si le build a eu lieu sur une autre machine :

```bash
docker save twentycrm/twenty:folder-path | gzip > twenty-folder-path.tar.gz
```

Puis, sur le serveur :

```bash
docker load -i twenty-folder-path.tar.gz
```

3. Vérifier que `.env` contient `TAG=folder-path`, puis recréer le serveur et le worker avec cette image :

```bash
docker compose up -d --force-recreate --no-deps server worker
```

Au démarrage, le conteneur `server` exécute les migrations (`yarn command:prod upgrade` dans `packages/twenty-docker/twenty/entrypoint.sh`), sauf si `DISABLE_DB_MIGRATIONS=true`. Le worker a les migrations désactivées : lui aussi doit tourner sur la même image, mais ce n’est pas lui qui migre.

4. Suivre le démarrage jusqu’à `Successfully migrated DB!` et un healthcheck vert :

```bash
docker compose logs -f server
```

Le healthcheck interroge `http://localhost:3000/healthz` dans le conteneur.

Si l’upgrade affiche un avertissement, le processus continue quand même. Lire les logs avant de considérer la mise à jour terminée. Relancer le conteneur `server` reprend les commandes d’upgrade déjà enregistrées. Ne pas supprimer les volumes pour « réessayer ».
