import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createWriteStream } from "node:fs";
import { chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";
import type { Request, Response } from "express";
import { objectStorageClient } from "../lib/objectStorage";

const router = Router();
const execFileAsync = promisify(execFile);
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");
let backupInProgress = false;

function getSessionUserId(req: Request) {
  const rawUserId = (req.session as unknown as Record<string, unknown>).userId;
  const userId = Number(rawUserId);
  return Number.isInteger(userId) && userId > 0 ? userId : undefined;
}

async function isSuperadmin(req: Request) {
  const userId = getSessionUserId(req);
  if (!userId) return false;
  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.role === "superadmin";
}

function parseStorageRoot(rawRoot: string) {
  const normalized = rawRoot.trim().replace(/^\/+|\/+$/g, "");
  const separator = normalized.indexOf("/");
  if (separator <= 0) return undefined;
  return {
    bucketName: normalized.slice(0, separator),
    objectPrefix: normalized.slice(separator + 1),
  };
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100) || "storage";
}

async function copyConfiguredObjectStorage(destination: string) {
  const roots = [
    process.env.PRIVATE_OBJECT_DIR,
    ...(process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(","),
  ].filter((value): value is string => Boolean(value?.trim()));
  const manifest: Array<{ root: string; object: string; file: string }> = [];
  const seen = new Set<string>();

  for (const rawRoot of roots) {
    const parsed = parseStorageRoot(rawRoot);
    if (!parsed) continue;
    const rootKey = `${parsed.bucketName}/${parsed.objectPrefix}`;
    if (seen.has(rootKey)) continue;
    seen.add(rootKey);

    const bucket = objectStorageClient.bucket(parsed.bucketName);
    const [files] = await bucket.getFiles({ prefix: parsed.objectPrefix });
    for (const file of files) {
      if (!file.name || file.name.endsWith("/")) continue;
      const relativeObjectName = file.name.startsWith(`${parsed.objectPrefix}/`)
        ? file.name.slice(parsed.objectPrefix.length + 1)
        : file.name;
      const target = join(destination, safeName(parsed.bucketName), safeName(parsed.objectPrefix), relativeObjectName);
      await mkdir(dirname(target), { recursive: true });
      await pipeline(file.createReadStream(), createWriteStream(target));
      manifest.push({
        root: `/${parsed.bucketName}/${parsed.objectPrefix}`,
        object: file.name,
        file: relative(destination, target),
      });
    }
  }

  await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return manifest.length;
}

async function writeRestoreGuide(destination: string, objectCount: number) {
  const guide = `# Respaldo completo de Control QSD

Este paquete fue generado desde la opción de respaldo del sistema.

## Contenido

- \`source/\`: código fuente y configuración del proyecto, sin dependencias instaladas ni secretos.
- \`database.sql\`: esquema y datos completos de PostgreSQL.
- \`uploads/\`: archivos locales que existan en el servidor.
- \`object-storage/\`: archivos encontrados en las rutas de Object Storage configuradas.
- \`object-storage/manifest.json\`: relación de objetos incluidos (${objectCount}).
- \`restore-database.sh\`: script opcional para restaurar PostgreSQL.

## Restauración en un workspace nuevo

1. Cree un nuevo workspace con Node.js, pnpm y PostgreSQL.
2. Copie el contenido de \`source/\` a la raíz del workspace.
3. Configure manualmente los secretos y variables del nuevo workspace. Este respaldo nunca contiene contraseñas, tokens, SESSION_SECRET ni claves de integración.
4. Instale dependencias con \`pnpm install\`.
5. Cree o conecte la base PostgreSQL y restaure los datos:

   \`psql "$DATABASE_URL" --set ON_ERROR_STOP=on -f database.sql\`

6. Vuelva a cargar los archivos de \`object-storage/\` en Object Storage y configure \`PRIVATE_OBJECT_DIR\` y \`PUBLIC_OBJECT_SEARCH_PATHS\` con las nuevas rutas.
7. Verifique el proyecto en desarrollo antes de publicarlo.

La restauración de archivos no reemplaza la configuración de secretos ni la publicación. Esos valores deben crearse de nuevo en el workspace destino.
`;
  await writeFile(join(destination, "RESTORE.md"), guide, "utf8");
  const restoreScript = `#!/usr/bin/env bash
set -euo pipefail

: "\${DATABASE_URL:?Define DATABASE_URL antes de restaurar}"
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
psql "$DATABASE_URL" --set ON_ERROR_STOP=on -f "$SCRIPT_DIR/database.sql"
echo "Base de datos restaurada correctamente."
`;
  const restoreScriptPath = join(destination, "restore-database.sh");
  await writeFile(restoreScriptPath, restoreScript, "utf8");
  await chmod(restoreScriptPath, 0o755);
}

router.get("/system/backups/download", async (req: Request, res: Response) => {
  if (!(await isSuperadmin(req))) {
    res.status(403).json({ error: "Sólo el superadmin puede generar respaldos completos" });
    return;
  }
  if (backupInProgress) {
    res.status(409).json({ error: "Ya hay otro respaldo en proceso. Intenta de nuevo en unos minutos." });
    return;
  }

  backupInProgress = true;
  const backupId = `control-qsd-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const temporaryRoot = await mkdir(join(tmpdir(), backupId), { recursive: true }).then(() => join(tmpdir(), backupId));
  const stagingRoot = join(temporaryRoot, "backup");
  const sourceTar = join(temporaryRoot, "source.tar");
  const databaseDump = join(stagingRoot, "database.sql");
  const archivePath = join(tmpdir(), `${backupId}.tar.gz`);

  try {
    await mkdir(join(stagingRoot, "source"), { recursive: true });
    await mkdir(join(stagingRoot, "uploads"), { recursive: true });
    await mkdir(join(stagingRoot, "object-storage"), { recursive: true });

    await execFileAsync("pg_dump", [
      "--format=plain",
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
      "--file",
      databaseDump,
    ], { env: process.env });

    await execFileAsync("tar", [
      "-cf",
      sourceTar,
      "--exclude=node_modules",
      "--exclude=*/node_modules",
      "--exclude=.git",
      "--exclude=./.git",
      "--exclude=.cache",
      "--exclude=./.cache",
      "--exclude=.local",
      "--exclude=./.local",
      "--exclude=*/dist",
      "--exclude=./dist",
      "--exclude=*/uploads",
      "--exclude=./uploads",
      "--exclude=.env*",
      "--exclude=*/.env*",
      "--exclude=*.pem",
      "--exclude=*.key",
      "-C",
      workspaceRoot,
      ".",
    ]);
    await execFileAsync("tar", ["-xf", sourceTar, "-C", join(stagingRoot, "source")]);

    const localUploadDirectories = [
      join(workspaceRoot, "uploads"),
      join(workspaceRoot, "artifacts", "api-server", "uploads"),
    ];
    for (const [index, sourceDirectory] of localUploadDirectories.entries()) {
      try {
        await cp(sourceDirectory, join(stagingRoot, "uploads", index === 0 ? "workspace" : "api-server"), {
          recursive: true,
          force: true,
        });
      } catch (error: unknown) {
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        if (code !== "ENOENT") throw error;
      }
    }

    const objectCount = await copyConfiguredObjectStorage(join(stagingRoot, "object-storage"));
    await writeRestoreGuide(stagingRoot, objectCount);
    await writeFile(
      join(stagingRoot, "BACKUP-METADATA.json"),
      JSON.stringify({
        application: "Control QSD",
        generatedAt: new Date().toISOString(),
        database: "PostgreSQL plain SQL dump",
        objectStorageFiles: objectCount,
        secretsIncluded: false,
      }, null, 2),
      "utf8",
    );

    await execFileAsync("tar", ["-czf", archivePath, "-C", stagingRoot, "."]);

    res.setHeader("Cache-Control", "no-store");
    res.download(archivePath, `${backupId}.tar.gz`, async (error) => {
      await rm(archivePath, { force: true }).catch(() => undefined);
      await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
      if (error && !res.headersSent) {
        res.status(500).json({ error: "No se pudo descargar el respaldo completo" });
      }
      backupInProgress = false;
    });
  } catch (error) {
    await rm(archivePath, { force: true }).catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
    backupInProgress = false;
    req.log.error({ err: error }, "Full backup generation failed");
    res.status(500).json({ error: "No se pudo generar el respaldo completo" });
  }
});

export default router;