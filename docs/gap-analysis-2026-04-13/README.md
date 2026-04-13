# Gap Analysis: giornalista parlamentare vs MCP

**Data:** 2026-04-13

## Cosa contiene questa cartella

Un'analisi strutturata per capire se l'MCP italianparliament-mcp risponde alle esigenze reali di un giornalista parlamentare.

Il metodo: due agenti — un **giornalista parlamentare** esperto e un **developer** — dialogano. Il giornalista definisce le sue esigenze concrete (user stories). Il developer le testa una per una con chiamate reali ai 24 tool MCP. Alla fine, un'analisi gap e una proposta di miglioramenti prioritizzati.

## I 4 documenti

| File | Chi parla | Contenuto |
|---|---|---|
| [giornalista-user-stories.md](giornalista-user-stories.md) | Giornalista | 33 user stories raggruppate in 9 aree tematiche, con priorita e domande concrete |
| [developer-test-report.md](developer-test-report.md) | Developer | Test reale di ogni user story: tool usato, risultato ottenuto, valutazione OK/PARZIALE/KO |
| [analisi-gap.md](analisi-gap.md) | Sintesi | Matrice user stories vs capacita MCP, 7 gap strutturali identificati |
| [proposta-miglioramenti.md](proposta-miglioramenti.md) | Sintesi | 14 miglioramenti prioritizzati per impatto, organizzati in 3 sprint |

## Risultato in breve

Su 33 user stories reali:

- **13 OK** (39%) — il tool risponde pienamente
- **14 PARZIALI** (42%) — funziona ma con limiti significativi
- **6 KO** (18%) — non possibile con i tool attuali

I gap piu gravi: ricerca full-text assente, commissioni non coperte, Senato incompleto (presentatore vuoto, no votazioni, no rank).

## Come usare questa analisi

La proposta di miglioramenti e organizzata in sprint:

1. **Sprint 1** (quick wins) — 5 parametri da aggiungere a tool esistenti, complessita molto bassa
2. **Sprint 2** (massimo impatto) — ricerca full-text + fix presentatore Senato
3. **Sprint 3** (completezza) — composizione commissioni + rank Senato + oggetto atti ispettivi
