"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Copy, Users } from "lucide-react";
import type { LiveResults } from "@/lib/live";

type Payload = {
  statut: string;
  mode: string;
  closesAt: string | null;
  results: LiveResults | null;
};

function scoreColor(v: number | null): string {
  if (v == null) return "#cbd5e1";
  if (v < 0.4) return "#ef4444";
  if (v < 0.7) return "#f59e0b";
  return "#22c55e";
}
const pctOf = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default function LiveDashboard({
  sessionId,
  joinUrl,
  initial,
}: {
  sessionId: string;
  joinUrl: string;
  initial: Payload;
}) {
  const [data, setData] = useState<Payload>(initial);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Sondage des résultats en direct.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/live/${sessionId}/results`, { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {
        /* ignore */
      }
    };
    const t = setInterval(poll, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sessionId]);

  // Compte à rebours.
  useEffect(() => {
    if (!data.closesAt || data.statut !== "ouverte") {
      setRemaining(null);
      return;
    }
    const end = new Date(data.closesAt).getTime();
    const tick = () => setRemaining(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data.closesAt, data.statut]);

  const r = data.results;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      {/* Lien à partager */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="text-xs font-medium text-[var(--muted)]">
          Lien à partager (Zoom, email…)
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={joinUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-lg border border-[var(--border)] bg-gray-50 p-2 text-sm"
          />
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      </div>

      {/* Bandeau live */}
      <div className="grid grid-cols-3 gap-4">
        <Stat
          icon={<Users className="h-4 w-4" />}
          value={`${r?.participantsCount ?? 0}`}
          label="participants"
        />
        <Stat value={pctOf(r?.overallAvg ?? null)} label="score moyen" />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          value={
            data.statut === "ouverte" && remaining != null
              ? mmss(remaining)
              : data.statut === "fermee"
                ? "terminée"
                : "—"
          }
          label="temps restant"
        />
      </div>

      {/* Synthèse par module (catégorie) */}
      {r && r.parModule.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Synthèse par module</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {r.parModule.map((m) => (
              <div
                key={m.module}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.module}</div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: m.avg == null ? "0%" : `${m.avg * 100}%`,
                        backgroundColor: scoreColor(m.avg),
                      }}
                    />
                  </div>
                </div>
                <div className="text-lg font-semibold">{pctOf(m.avg)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synthèse collective par compétence (vue projetable) */}
      <div>
        <h3 className="text-sm font-semibold">Synthèse collective par compétence</h3>
        <div className="mt-2 space-y-2 rounded-xl border border-[var(--border)] bg-white p-4">
          {r && r.parCompetence.length > 0 ? (
            r.parCompetence.map((c) => (
              <div key={c.competencyId} className="flex items-center gap-3">
                <div className="w-40 shrink-0 truncate text-sm">{c.nom}</div>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: c.avg == null ? "0%" : `${c.avg * 100}%`,
                      backgroundColor: scoreColor(c.avg),
                    }}
                  />
                </div>
                <div className="w-10 shrink-0 text-right text-sm font-semibold">
                  {pctOf(c.avg)}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">En attente de réponses…</p>
          )}
        </div>
      </div>

      {/* Résultats individuels */}
      <div>
        <h3 className="text-sm font-semibold">Résultats individuels</h3>
        <div className="mt-2 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2">Participant</th>
                <th className="px-4 py-2">Avancement</th>
                <th className="px-4 py-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {r && r.individuels.length > 0 ? (
                r.individuels.map((p) => (
                  <tr key={p.participantId}>
                    <td className="px-4 py-2 font-medium">
                      {p.prenom} {p.nom}
                      {p.finished && (
                        <span className="ml-2 text-[11px] text-green-600">terminé</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[var(--muted)]">
                      {p.repondu}/{p.total}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">{pctOf(p.score)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-[var(--muted)]">
                    Personne n&apos;a encore rejoint.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-center gap-1.5 text-xl font-semibold">
        {icon} {value}
      </div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
