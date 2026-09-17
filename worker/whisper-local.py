# Reconnaissance vocale sur l'appareil (Apple Silicon, MLX) — remplace l'appel
# Groq. Sortie calquée sur `verbose_json` de l'API OpenAI/Groq pour que
# src/routes/transcribe.js n'ait qu'un seul format à lire.
#
# Pourquoi local : Groq facture 0,00067 $ la minute et exige une clé. Sur M4 le
# large-v3-turbo tourne à ~3x le temps réel sur le GPU, coût marginal nul, et la
# route /v1/transcribe cesse de dépendre d'un tiers.
import contextlib
import json
import sys

import mlx_whisper

chemin = sys.argv[1]
langue = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None

# mlx_whisper écrit « Detected language: … » sur stdout même en verbose=False,
# ce qui casse le JSON lu par le worker. On détourne sa sortie vers stderr.
with contextlib.redirect_stdout(sys.stderr):
    r = mlx_whisper.transcribe(
        chemin,
        path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
        language=langue,
        verbose=False,
    )

segments = [
    {"start": s.get("start", 0.0), "end": s.get("end", 0.0), "text": s.get("text", "")}
    for s in r.get("segments", [])
]
duree = segments[-1]["end"] if segments else None

json.dump(
    {"text": r.get("text", ""), "language": r.get("language"), "duration": duree, "segments": segments},
    sys.stdout,
)
