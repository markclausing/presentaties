# Vibe Coding — presentatie

Scroll-presentatie in HTML (geen build, geen dependencies). Openen:

```bash
cd vibe-coding && python3 -m http.server 8000   # dan http://localhost:8000
```

Dubbelklikken op `index.html` werkt ook. Alleen de lettertypes (Google Fonts), GitHub-avatars en de "speel live"-knoppen hebben internet nodig.

## Bediening

| Toets | Actie |
|---|---|
| `→` `↓` `spatie` `PgDn` | volgende (werkt ook met een presenter-clicker) |
| `←` `↑` `PgUp` | vorige |
| `1`–`6` / `0` | spring naar hoofdstuk / begin |
| `N` | sprekersnotities (met tijdsindicatie per slide) |
| `T` / `R` | timer starten-pauzeren / resetten. Een hoofdstuk kleurt roze als je over je budget gaat |
| `L` | game op de huidige slide live spelen (iframe) |
| `F` | volledig scherm |
| `?` | hulp |

Klik op een screenshot om in te zoomen. Op de WebTrack-slide kun je de voor/na-slider slepen.

## Gameplay-video's

Alle game-slides hebben een video in `assets/video/` (de screenshots zijn de terugval). Opnieuw opnemen:

```bash
node tools/record-games.mjs                     # alles
node tools/record-games.mjs websoccer webtype   # alleen deze
```

De games moeten in `~/Development/<naam>` staan; de tool start zelf hun servers. Voor Prompt Machina moet `pnpm dev` draaien in `~/Development/PHK-RPG` (Vite-adres via `PHK_URL`, standaard `http://localhost:5174/`).

Hoe het werkt: Chrome draait de game met een nepklok (`tools/recorder.mjs`). Per videoframe gaat de tijd 1/30 s vooruit, wordt één frame getekend en gefotografeerd, en ffmpeg maakt er een mp4 van. Daardoor loopt de video vloeiend, hoe traag de rendering ook is. WebSoccer spoelt vooruit tot er een doelpunt valt en spoelt dan terug (de simulatie is deterministisch). Article 5 en Prompt Machina gebruiken de echte GPU, dus er verschijnt kort een Chrome-venster.

## Ongebruikte beelden

In `assets/img` staan nog `prompt-start`, `instructies-md`, `endorfine`, `architecture`, `arch-viewer` en `vc-icon` uit de oude deck. Handig als je meer screenshots van de workflow wilt toevoegen.
