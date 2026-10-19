# Mileage Log

Mileage allowances differ by country and the rules trip people up: in Germany an editable spreadsheet is not an accepted Fahrtenbuch, and in 2026 both HMRC and the IRS changed their rates. This tool gives you the right form or the right number for each.

**Use it online:** [hmsk.life/tools/mileage](https://hmsk.life/tools/mileage/) (runs in your browser, nothing is sent anywhere).

## What it does

- **Germany.** Prints a Fahrtenbuch (A4 landscape) with every entry R 8.1 Abs. 9 Nr. 2 LStR asks for: date, odometer at start and end, destination with address, purpose, customer visited, route if you take a detour, type of trip (D/P/W), numbered rows, carry-over per page and a page of filling-in rules. The German log is deliberately **not** stored: a log whose entries can be changed afterwards without a trace is not an ordnungsgemäßes Fahrtenbuch (BFH, 16.11.2005, VI R 64/04), so you print the form and fill it in by hand.
- **Entfernungspauschale** for 2025 and 2026 (§ 9 Abs. 1 Satz 3 Nr. 4 EStG): 0.38 € per full km from the first km since 2026 (2025: 0.30 € for km 1 to 20), 4,500 € cap unless you drive your own or a provided car.
- **Dienstreise / business trips** (§ 9 Abs. 1 Satz 3 Nr. 4a EStG with § 5 BRKG): 0.30 € per km by car, 0.20 € by other motor vehicles, no flat rate for bicycles.
- **UK.** HMRC approved mileage allowance per tax year (6 April to 5 April): cars and vans 55p for the first 10,000 business miles from 2026-27 (45p from 2011-12 to 2025-26), then 25p; motorcycles 24p; bicycles 20p; 5p per colleague carried. Trips that cross 10,000 miles are split. Enter what your employer paid to see the Mileage Allowance Relief to claim, or the taxable excess.
- **US.** IRS standard mileage rate by trip date: 2025 70¢; 1 Jan to 30 Jun 2026 72.5¢; from 1 Jul 2026 76¢ (IR-2026-29). Medical/military moving and charity rates, parking and tolls.
- UK and US trips are kept in `localStorage` in your browser. Export CSV (formula-safe) or print to PDF, import the CSV back.
- English and German. A built-in self-test checks every calculation against hand-computed values on each load and shows the result under "Sources".

All rates live in [`public/config.js`](public/config.js), each with its official source and the date checked (19 October 2026). Not tax advice.

## Quick start

No build step, no dependencies. Serve `public/` with any static web server:

```sh
python3 -m http.server 8080 --directory public
# open http://localhost:8080/
```

(ES modules do not load from `file://`, so a server is needed.)

Run the tests (Node.js 20+):

```sh
node --test tests/
```

## Files

| File | What |
|---|---|
| `public/config.js` | every rate with its source URL |
| `public/calc.js` | pure calculations and the self-test cases, no DOM |
| `public/i18n.js` | English and German texts |
| `public/app.js`, `index.html`, `app.css` | the UI and the print layouts |

To self-host, set `LINK_BASE` in `public/config.js` if the top-strip links should point somewhere other than hmsk.life. Fonts (Martian Mono, Geist; SIL Open Font License) are in `public/assets/fonts/`.

## Updating rates

Change the numbers in `public/config.js` (`DE_COMMUTE`, `DE_BUSINESS`, `UK_RATES` and `UK_LATEST`, `US_PERIODS`), add matching cases to `CASES` in `public/calc.js`, update the facts in `public/i18n.js`, run the tests.

## License

MIT, see [LICENSE](LICENSE).
