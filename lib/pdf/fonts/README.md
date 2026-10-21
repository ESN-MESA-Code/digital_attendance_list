# Bundled fonts

`LiberationSans-{Regular,Bold}.ttf` back the attendance-list PDF export.

Liberation Sans is metric-compatible with Arial/Helvetica and is the font the
official MESA "Teilnehmendenliste" Word template uses, so the generated PDF
lines up with the printed form. Unlike pdf-lib's built-in Helvetica (WinAnsi
only, ~224 glyphs) it can render the full Latin-script range, which matters for
participant names such as "Čermák", "Kowalczyk-Wójcik" or "Şahin".

Licensed under the SIL Open Font License 1.1 — see `LICENSE`.

## Regenerating

These are subsets of the upstream fonts, cut down from ~410 KB to ~84 KB:

```sh
pyftsubset LiberationSans-Regular.ttf \
  --output-file=LiberationSans-Regular.subset.ttf \
  --unicodes="U+0020-00FF,U+0100-017F,U+0180-024F,U+02B0-02FF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2000-206F,U+20A0-20BF,U+2122,U+2212" \
  --layout-features='' --no-hinting --desubroutinize
```

The files are loaded from disk at runtime, so `next.config.ts` lists this
directory under `outputFileTracingIncludes` for the PDF route.
