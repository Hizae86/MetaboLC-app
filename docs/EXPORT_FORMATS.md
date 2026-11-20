# Export formats

MetaboLC exports **transition tables**, not native acquisition methods.
Native method files (`.meth`, `.m`, `.lcm`, `.dam`, MassLynx `.exp`) are closed,
version-dependent formats tied to each instrument's configuration; writing them
from outside the vendor software is not reliable. The tables are what each
method editor can import or paste, so the analyst builds the method with their
own source and LC settings and imports the transitions instead of typing them.

The formats live in `backend/exports.py`. Each one has a verification status
that the export menu shows to users.

| Key | Format | Software | Status |
| --- | --- | --- | --- |
| `skyline` | Small-molecule transition list | Skyline | Documented (column names from Skyline's small-molecule tutorials) |
| `sciex` | MRM table, tab-separated | SCIEX OS / Analyst | Not yet verified |
| `waters` | MRM table | MassLynx / waters_connect | Not yet verified |
| `thermo` | SRM table | TSQ method editor / TraceFinder | Not yet verified |
| `agilent` | dMRM table | MassHunter Acquisition | Not yet verified |
| `shimadzu` | MRM table | LabSolutions | Not yet verified |
| `generic` | Every stored transition field | Excel | Documented (our own format) |

## Rules every exporter follows

- **Only stored values are written.** A missing CE, DP, cone voltage, dwell or
  RT window is left blank, never replaced by a typical value.
- **Polarity** comes from the method when it runs in one polarity. Older
  records defaulted every transition to ESI+, so the per-transition value is
  only trusted for polarity-switching methods.
- **Rows are ordered** by retention time, then compound, quantifier first,
  internal standards after their analytes.
- **Skyline internal standards**: a labelled copy of an analyte
  (`Cortisol-d4`, `25-OH-Vitamin D3-d6 (IS)`) is written as that analyte's
  `heavy` form; a different molecule used as IS (ascomycin for tacrolimus)
  is written as its own molecule.

## Verifying a format

A format is marked as tested only after a real export has been imported into
that software without manual fixes.

1. Export a method from MetaboLC in that format, ideally one with several
   compounds, an internal standard and, if possible, both polarities.
2. Import or paste it into the software's method editor.
3. If a column is not recognised or has the wrong name, export the transition
   table of any existing method from that software and send it as a reference;
   the exporter is then changed to match it exactly.
4. When it imports cleanly, set `tested_in` for that format in
   `backend/exports.py`, for example `tested_in="MassHunter Acquisition 12.1"`.
   The export menu then shows "Tested in …" instead of "Not yet verified".

Record the software version: column names change between versions.
