# Presentaties over vibe coding

Presentaties van Mark Clausing over wat er gebeurt als iemand die al twintig jaar niet zelf programmeert, AI-agents het werk laat doen. Eerst een fitness-app voor de iPhone, daarna een reeks browsergames, en uiteindelijk een rollenspel dat zes vrienden samen bouwen via GitHub. Geen regel code zelf geschreven, wel elke regel door CI gecontroleerd.

## ▶ [Bekijk de presentatie: Vibe coding (oktober 2026)](https://markclausing.github.io/presentaties/vibe-coding/)

Een scroll-presentatie in HTML voor collega's bij Digital Delivery (Alliander), met gameplay-video's van de games. Werkt op een groot scherm en op een telefoon.

| Hoofdstuk | Over |
|---|---|
| 01 · Wat is vibe coding | Waar de term vandaan komt (Karpathy, februari 2025) en hoe het zich verhoudt tot AI-assistenten en agents |
| 02 · Hoe ik begon | Van een Gemini-abonnement voor een spreekbeurt naar een iOS-app met 756 commits, en hoe security en kwaliteit worden afgedwongen |
| 03 · De games | WebSoccer, WebRacing, WebType, WebTrack, Article 5 en Prompt Machina, met video's |
| 04 · Learnings | Snel bouwen, steeds betere modellen, samenwerken, en waar de bottleneck nu zit |
| 05 · De toekomst | Wat dit betekent voor developers, scrum-teams en Change Delivery |

### ✏️ [Concept: met een hoofdstuk over output versus outcome](https://markclausing.github.io/presentaties/vibe-coding-concept/)

Een conceptversie met een extra hoofdstuk: vibe coding maakt output bijna gratis, maar het valideren van de echte outcome gaat er niet sneller van. Wat betekent dat voor een werkwijze als SAFe, met de nadruk op voorspelbaarheid en delivery? Met DORA 2024, METR 2025 en de ART Predictability Measure.

Presenteren: pijltjes of spatie om door te gaan, `N` voor sprekersnotities, `T` voor de timer, `L` om een game live te spelen, `?` voor alle toetsen. Meer in [vibe-coding/README.md](vibe-coding/README.md).

## Eerdere versies

- [Vibe Coding: gewoon starten](Vibe%20Coding%20-%20gewoon%20starten.pdf) (april 2026)
- [Vibe Coding: gewoon starten, v2](Vibe%20Coding%20-%20gewoon%20starten%20v2.pdf) (juli 2026)

## De projecten uit de presentaties

- [vibecoach](https://github.com/markclausing/vibecoach): de AI-fitnesscoach voor iOS
- [websoccer](https://github.com/markclausing/websoccer) · [speel](https://markclausing.github.io/websoccer/)
- [webracing](https://github.com/markclausing/webracing) · [speel](https://markclausing.github.io/webracing/)
- [webtype](https://github.com/markclausing/webtype) · [speel](https://markclausing.github.io/webtype/)
- [webtrack](https://github.com/markclausing/webtrack) · [speel](https://markclausing.github.io/webtrack/)
- [webTA (Article 5)](https://github.com/markclausing/webTA) · [speel](https://markclausing.github.io/webTA/)
- PHK-RPG (Prompt Machina): een besloten project, de repository is privé

## Zelf openen

```bash
cd vibe-coding && python3 -m http.server 8000   # dan http://localhost:8000
```

Geen build-stap en geen dependencies. De gameplay-video's zijn opgenomen met [`vibe-coding/tools/record-games.mjs`](vibe-coding/tools/record-games.mjs).
