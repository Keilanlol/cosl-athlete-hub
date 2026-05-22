// Convertit une erreur Supabase / PostgREST / PostgreSQL en message FR lisible.
type AnyErr = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
} | null | undefined;

const TABLE_LABELS: Record<string, string> = {
  athletes: "athlètes",
  clubs: "clubs",
  federations: "fédérations",
  club_members: "membres de club",
  federation_members: "membres de fédération",
  coaches: "encadrants",
  games: "jeux",
  selections: "sélections",
  accreditations: "accréditations",
  accommodations: "hébergements",
  flights: "vols",
  travel_plans: "déplacements",
  user_profiles: "utilisateurs",
  athlete_documents: "documents athlète",
};

function humanTable(raw?: string | null): string {
  if (!raw) return "cet élément";
  return TABLE_LABELS[raw] ?? raw.replace(/_/g, " ");
}

export function friendlyError(err: AnyErr, fallback = "Une erreur est survenue"): string {
  if (!err) return fallback;
  const msg = err.message ?? "";
  const details = err.details ?? "";
  const code = err.code ?? "";

  // 23503 foreign_key_violation
  if (code === "23503" || /foreign key|violates foreign key/i.test(msg)) {
    const m = /table "([^"]+)"/.exec(details) || /table "([^"]+)"/.exec(msg);
    const tbl = humanTable(m?.[1]);
    return `Suppression impossible : cet élément est encore utilisé par des ${tbl}. Retirez d'abord ces liaisons puis réessayez.`;
  }

  // 23505 unique_violation
  if (code === "23505" || /duplicate key|already exists/i.test(msg)) {
    const m = /Key \(([^)]+)\)=\(([^)]+)\)/.exec(details);
    if (m) return `Cette valeur existe déjà : ${m[1]} = « ${m[2]} ».`;
    return "Cette valeur existe déjà dans la base.";
  }

  // 23502 not_null_violation
  if (code === "23502" || /null value in column/i.test(msg)) {
    const m = /column "([^"]+)"/.exec(msg);
    return `Le champ « ${m?.[1] ?? "obligatoire"} » est requis.`;
  }

  // 23514 check_violation
  if (code === "23514") return "Une des valeurs saisies n'est pas valide.";

  // 22P02 invalid_text_representation
  if (code === "22P02") return "Format de donnée invalide (date, nombre ou identifiant).";

  // RLS
  if (code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "Vous n'avez pas les droits pour effectuer cette action.";
  }

  // Auth
  if (/invalid login|invalid credentials/i.test(msg))
    return "Identifiants invalides.";
  if (/jwt|token/i.test(msg) && /expired|invalid/i.test(msg))
    return "Session expirée, veuillez vous reconnecter.";

  // Network
  if (/failed to fetch|networkerror|load failed/i.test(msg))
    return "Impossible de joindre le serveur. Vérifiez votre connexion.";

  return msg || fallback;
}
