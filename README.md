# JISOGI: Anime Studio Tycoon (browser edition)

A digital version of the JISOGI board game (rulebook edition 1.5). Run an anime studio for four years: hire staff, write scripts, chase trends and release anime before your debts catch up with you.

## Play

There's no build step. Serve the folder and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(The card art loads from `cards/`, so it has to be served rather than opened as a `file://` page in some browsers.)

## Modes

- **Multiplayer**: 2–4 studios. Each one can be played by a human (hot-seat on one screen) or by the AI.
- **Solo challenges**: all 8 Solo Challenge cards, including High-Demand tokens and each card's special rules.
- **Achievements**: top scores for each solo challenge and for 2, 3 and 4-studio games. Saved in the browser, and privately to your claude.ai account in the published version.

## What's implemented

- Production Phase: worker placement on 7 actions with staff-type restrictions, Genki red-box bonuses, High Demand Fees, the 4 Strategize Leverages and their Lock tokens.
- Release Phase: genre matching, popularity (matches × level + bonuses), Cult releases, trend position bonuses, the +4♥ trend tokens, Hype spending, the Release Reward table, Merchandise Deals and Opportunity cards.
- Upkeep Phase: merch income, paying back debt, interest, salaries, staff pool refresh and Opportunity reveals.
- All 52 Genki Staff with their real skills and genre bonuses, plus the Dead-Inside staff (art in `cards/`).
- Debt (+7¥ automatically when you can't pay), the 29★ reputation cap, and final scoring.

## Stand-in content

Some components weren't available, so they're placeholders built to the rulebook's structure:
Script Part titles, the 20 Trend cards, the 12 Opportunity cards (except Flawless Execution and Merchandise Mogul), and 18 of the 20 Network cards (Senpai Training and Achievement Award are real). They're all data in `data.js` and easy to replace.

## Files

- `index.html`: page and styles
- `data.js`: cards and solo challenges
- `game.js`: rules engine and AI
- `scores.js`: achievements and best scores
- `ui.js`: rendering and input
