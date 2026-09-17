// Transcription audio payée en x402 — YouTube, TikTok, Instagram.
//
// Pourquoi cette route existe ici plutôt qu'uniquement sur Apify. Le magasin
// Apify prélève 20 % et facture le calcul ET le transfert proxy ; mesuré le
// 06/08, ces frais dépassaient la recette avant correction. Sur la ferme, il ne
// reste que le coût Groq — 0,00067 $ la minute d'audio — et l'agent paie en
// USDC sans compte ni carte.
//
// Le travail se fait sur le Mac mini, jamais sur Vercel, pour deux raisons :
//   - l'IP RÉSIDENTIELLE passe là où les IP datacenter sont refusées. Mesuré :
//     YouTube renvoie « Sign in to confirm you're not a bot » depuis un
//     datacenter, et passe sans broncher depuis la fibre ;
//   - yt-dlp et ffmpeg y sont installés ; une fonction serverless ne peut ni
//     les héberger durablement ni télécharger 6 Mo dans son budget de temps.

import { Router } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);
const router = Router();

const WORKER_URL = (process.env.WORKER_URL || "").replace(/\/+$/, "");
const WORKER_SECRET = process.env.WORKER_SECRET || "";
const GROQ = process.env.GROQ_API_KEY || "";
const MODELE = process.env.GROQ_MODEL || "whisper-large-v3-turbo";

const PLATEFORMES = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|tiktok\.com|instagram\.com)\//i;

function plateforme(u) {
  if (/youtube\.com|youtu\.be/i.test(u)) return "youtube";
  if (/tiktok\.com/i.test(u)) return "tiktok";
  if (/instagram\.com/i.test(u)) return "instagram";
  return "autre";
}

/** Extraction locale — n'est appelée que sur le worker. */
async function extraireEtTranscrire(url, langue) {
  const d = await mkdtemp(join(tmpdir(), "tx-"));
  try {
    await run("yt-dlp", [
      "--no-warnings",
      // Le PLUS PETIT flux audio suffisant, pas le meilleur : Whisper
      // rééchantillonne en 16 kHz mono, donc au-delà de ~50 kbps chaque octet
      // est transféré pour rien. Mesuré : 17,9 Mo contre 6,5 pour le même texte.
      "-f", "ba[abr<=70]/ba[abr<=100]/ba/b",
      "-x", "--audio-format", "mp3",
      "--postprocessor-args", "ffmpeg:-ac 1 -ar 16000 -b:a 32k",
      // Titre / auteur / id récupérés PENDANT le téléchargement : `--write-info-json`
      // n'ajoute aucun aller-retour réseau, là où un second appel yt-dlp coûterait
      // 2-3 s et un risque de blocage supplémentaire. Ces champs servent aux actors
      // Apify, qui les affichent dans leur jeu de données.
      "--write-info-json",
      "-o", join(d, "a.%(ext)s"), url,
    ], { timeout: 240_000, maxBuffer: 1 << 22 });

    const fichiers = await readdir(d);
    const f = fichiers.find((x) => x.endsWith(".mp3"));
    if (!f) throw new Error("aucun_audio");
    const buf = await readFile(join(d, f));

    // Absence de métadonnées = perte cosmétique : jamais une raison d'échouer
    // une transcription qui a, elle, parfaitement abouti.
    let infos = {};
    const fi = fichiers.find((x) => x.endsWith(".info.json"));
    if (fi) { try { infos = JSON.parse(await readFile(join(d, fi), "utf8")); } catch {} }

    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/mpeg" }), "a.mp3");
    form.append("model", MODELE);
    form.append("response_format", "verbose_json");
    if (langue) form.append("language", langue);

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${GROQ}` },
      body: form,
      signal: AbortSignal.timeout(300_000),
    });
    if (!r.ok) throw new Error(`groq_${r.status}`);
    const j = await r.json();

    return {
      url,
      platform: plateforme(url),
      video_id: infos.id || null,
      title: infos.title || null,
      uploader: infos.uploader || infos.channel || null,
      language: j.language || null,
      duration_seconds: j.duration ?? infos.duration ?? null,
      transcript: (j.text || "").trim(),
      segments: (j.segments || []).map((s) => ({
        start: Math.round((s.start ?? 0) * 100) / 100,
        end: Math.round((s.end ?? 0) * 100) / 100,
        text: (s.text || "").trim(),
      })),
      // Prouve au client que le texte vient de l'audio et non d'un fichier de
      // sous-titres : c'est la promesse commerciale de la route.
      source: "audio-asr",
      served_by: "residential",
    };
  } finally {
    await rm(d, { recursive: true, force: true }).catch(() => {});
  }
}

router.get("/v1/transcribe", async (req, res) => {
  const url = String(req.query.url || "").trim();
  const langue = String(req.query.language || "").trim() || null;

  if (!url || !PLATEFORMES.test(url)) {
    return res.status(400).json({
      error: "invalid_url",
      detail: "Provide ?url= a YouTube, TikTok or Instagram video URL.",
      example: "/v1/transcribe?url=https://www.tiktok.com/@nasa/video/7670721000471891214",
    });
  }
  if (!GROQ && !WORKER_URL) {
    return res.status(503).json({ error: "engine_unavailable", detail: "No transcription engine configured." });
  }

  try {
    // Sur Vercel : déléguer au mini. Sur le mini : exécuter.
    if (WORKER_URL) {
      const up = await fetch(`${WORKER_URL}/v1/transcribe?url=${encodeURIComponent(url)}${langue ? `&language=${langue}` : ""}`, {
        headers: { "x-worker-secret": WORKER_SECRET },
        signal: AbortSignal.timeout(300_000),
      });
      const txt = await up.text();
      res.status(up.status).type("application/json").send(txt);
      return;
    }
    res.json(await extraireEtTranscrire(url, langue));
  } catch (e) {
    const m = String(e.message || e);
    // Distinguer ce qui n'a rien à transcrire d'une vraie panne : l'agent doit
    // savoir s'il peut réessayer ou non.
    if (/aucun_audio|no audio|No video formats/i.test(m)) {
      return res.status(422).json({ error: "nothing_to_transcribe", detail: "This post has no audio track (photo, carousel or silent video)." });
    }
    if (/sign in to confirm|not a bot|requiring login|empty media response/i.test(m)) {
      return res.status(502).json({ error: "source_refused", detail: "The platform refused the request. Retry in a few minutes." });
    }
    res.status(502).json({ error: "transcription_failed", detail: m.slice(0, 200) });
  }
});

export default router;
