import { useEffect, useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  parseCsv,
  runImport,
  matchColumns,
  type CsvImportConfig,
  type ImportResult,
  type ColumnMatch,
} from "@/lib/csv-import";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: CsvImportConfig;
  onImported?: () => void;
};

type Stage = "upload" | "preview" | "importing" | "result";

export function CsvImportDialog({ open, onOpenChange, config, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [columnMatches, setColumnMatches] = useState<Record<string, ColumnMatch>>({});

  const reset = () => {
    setStage("upload");
    setRows([]);
    setResult(null);
    setProgress({ current: 0, total: 0 });
    setColumnMatches({});
  };

  // Reset when dialog opens (handles case where user re-opens without closing first)
  useEffect(() => {
    if (open) reset();
  }, [open]);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Veuillez sélectionner un fichier CSV");
      return;
    }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast.error("Le fichier CSV est vide ou mal formaté");
      return;
    }
    const headers = Object.keys(parsed[0]);
    const matches = matchColumns(headers, config.columns);
    setColumnMatches(matches);
    setRows(parsed);
    setStage("preview");
  };

  const handleImport = async () => {
    setStage("importing");
    setProgress({ current: 0, total: rows.length });
    const res = await runImport(config, rows, (current, total) => {
      setProgress({ current, total });
    });
    setResult(res);
    setStage("result");
    if (res.inserted > 0 || res.updated > 0) {
      toast.success(`${res.inserted} créé(s), ${res.updated} mis à jour`);
      onImported?.();
    }
  };

  const downloadTemplate = () => {
    const headers = config.columns.map((c) => c.key).join(";");
    const example = config.columns.map((c) => c.label).join(";");
    const blob = new Blob([`${headers}\n${example}\n`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_${config.table}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];

  const missingRequired = config.columns.filter(
    (c) => c.required && !columnMatches[c.key]?.found,
  );
  const canImport = missingRequired.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importer des {config.entityName.toLowerCase()}s
          </DialogTitle>
          <DialogDescription>
            Sélectionnez un fichier CSV. Les doublons seront mis à jour automatiquement.
          </DialogDescription>
        </DialogHeader>

        {/* Upload stage */}
        {stage === "upload" && (
          <div className="py-6 space-y-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-10 cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
            >
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Cliquez pour sélectionner un fichier CSV</p>
                <p className="text-xs text-muted-foreground mt-1">ou glissez-déposez votre fichier ici</p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Format attendu :</p>
                <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Modèle CSV
                </Button>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {config.columns.map((c) => (
                    <span
                      key={c.key}
                      className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs font-mono ${
                        c.required
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.key}
                      {c.required && <span className="text-red-500">*</span>}
                    </span>
                  ))}
                </div>
                {config.links && config.links.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    + colonnes de liaison : {config.links.map((l) => l.csvColumn).join(", ")} —
                    les entités manquantes seront créées automatiquement.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Le matching des colonnes est flexible (insensible à la casse, aux accents et aux espaces).
                Les champs marqués <span className="text-red-500">*</span> sont obligatoires.
              </p>
            </div>
          </div>
        )}

        {/* Preview stage */}
        {stage === "preview" && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span><strong>{rows.length}</strong> ligne(s) détectée(s)</span>
            </div>

            {/* Column mapping */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Correspondance des colonnes :</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Champ attendu</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Colonne CSV</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.columns.map((col) => {
                      const m = columnMatches[col.key];
                      return (
                        <tr key={col.key} className="border-t border-border">
                          <td className="px-3 py-1.5 font-mono">
                            {col.key}
                            {col.required && <span className="text-red-500 ml-0.5">*</span>}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">
                            {m?.csvHeader ?? "—"}
                          </td>
                          <td className="px-3 py-1.5">
                            {m?.found ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                <CheckCircle2 className="h-3 w-3 mr-0.5" /> Trouvé
                              </Badge>
                            ) : col.required ? (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                                <AlertCircle className="h-3 w-3 mr-0.5" /> Manquant
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Optionnel
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Missing required warning */}
            {missingRequired.length > 0 && (
              <div className="rounded-md border-2 border-red-300 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">Impossible d'importer : colonnes obligatoires manquantes</p>
                <p className="mt-1 text-xs">
                  Les colonnes suivantes sont requises mais n'ont pas été trouvées dans le fichier CSV :{" "}
                  <strong>{missingRequired.map((c) => c.key).join(", ")}</strong>
                </p>
                <p className="mt-1 text-xs">
                  Téléchargez le modèle pour voir le format attendu, puis réessayez.
                </p>
              </div>
            )}

            {/* Data preview */}
            {canImport && (
              <>
                <p className="text-sm font-medium text-foreground">Aperçu des données :</p>
                <div className="rounded-lg border border-border overflow-auto max-h-[200px]">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">#</th>
                        {previewHeaders.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                          {previewHeaders.map((h) => (
                            <td key={h} className="px-2 py-1 whitespace-nowrap max-w-[180px] truncate">
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 20 && (
                  <p className="text-xs text-muted-foreground">
                    Affichage des 20 premières lignes sur {rows.length}.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Importing stage */}
        {stage === "importing" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">
              Importation en cours… {progress.current}/{progress.total}
            </p>
            <div className="w-full max-w-xs h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Result stage */}
        {stage === "result" && result && (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-700">{result.inserted}</p>
                <p className="text-xs text-emerald-600">Créés</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-600">Mis à jour</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                <AlertCircle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">{result.skipped.length}</p>
                <p className="text-xs text-amber-600">Ignorés</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                <AlertCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                <p className="text-xs text-red-600">Erreurs</p>
              </div>
            </div>

            {result.skipped.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-700">Lignes ignorées (doublons dans le fichier)</p>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 max-h-[150px] overflow-auto">
                  {result.skipped.map((s, i) => {
                    const name = Object.values(s.row).slice(0, 3).filter(Boolean).join(" ");
                    return (
                      <div key={i} className="px-3 py-1.5 text-xs border-b border-amber-100 last:border-0">
                        <span className="text-amber-700 font-medium">{name}</span>
                        <span className="text-muted-foreground ml-2">— {s.reason}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-700">Erreurs</p>
                <div className="rounded-lg border border-red-200 bg-red-50/50 max-h-[150px] overflow-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs border-b border-red-100 last:border-0">
                      <span className="text-red-700 font-medium">Ligne {i + 1}</span>
                      <span className="text-muted-foreground ml-2">— {e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {stage === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          )}
          {stage === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Retour</Button>
              <Button
                onClick={handleImport}
                disabled={!canImport}
                className="bg-primary hover:bg-[var(--cosl-red-dark)]"
              >
                {canImport ? `Importer ${rows.length} ligne(s)` : "Colonnes manquantes"}
              </Button>
            </>
          )}
          {stage === "result" && (
            <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}