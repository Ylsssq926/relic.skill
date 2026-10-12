# Soul Fingerprint System

> 一枚 Relic 可以模仿风格，但不能没有指纹。
> *A Relic can imitate style, but it cannot be fingerprintless.*

## Goals

The soul fingerprint system does four things:

- Generates a unique fingerprint for every Relic
- Embeds the same fingerprint into all output files
- Verifies authenticity on load, share, and archive
- Triggers tamper detection when content is altered secretly

## Fingerprint Generation Rules

Every Relic's fingerprint is a normalized hash of its core content.

### 1. Collect core files

Recommended inclusion:

- `SKILL.md`
- `personality.md`
- `interaction.md`
- `memory.md`
- `manifest.json`

If a Relic lacks one of these files, skip it; but once the file is added later, the fingerprint must be re-signed.

### 2. Normalize content

Uniform processing before hashing:

- Encoding normalized to `UTF-8`
- Line endings normalized to `LF`
- Trailing whitespace stripped per line
- Files sorted by path lexicographically
- Ignore any fingerprint fields already in the files, to avoid "signing your own signature again"

Exclude these metadata fields from the computation:

- `relic-fingerprint` in Markdown front matter
- `relic-authenticity` in Markdown front matter
- `fingerprint` in JSON
- `previous_fingerprint` in JSON
- `issued_at` in JSON
- `fingerprint_version` in JSON

### 3. Per-file hashes first, then the master fingerprint

Compute `SHA-256` per core file, then concatenate in this format:

```text
SKILL.md:<sha256>
interaction.md:<sha256>
manifest.json:<sha256>
memory.md:<sha256>
personality.md:<sha256>
```

Then compute `SHA-256` over the concatenated result — that is the final soul fingerprint.

Recommended format:

```text
relic:sha256:<64-char hex hash>
```

## Embedding Rules

All output files carry the same soul fingerprint.

### Markdown files

Write at the top of the file:

```yaml
---
relic-fingerprint: relic:sha256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
relic-authenticity: verified
---
```

### JSON files

Write in the root object:

```json
{
  "fingerprint": "relic:sha256:...",
  "authenticity": "verified"
}
```

### Derived assets (images, audio, video)

Do not rewrite the original files; register in `manifest.json` instead:

- File name
- Resource hash
- Owning Relic fingerprint
- Generation time

## Verification Rules

Before every load or publication, recompute the core file hashes and compare with the embedded fingerprint:

- Fingerprint matches: "authentic"
- Fingerprint missing: "incomplete provenance"
- Fingerprint mismatch: "possibly tampered"
- Core file set changed without re-signing: "version drift"

## Tamper-Detection Results

| Status | Meaning | Handling |
|---|---|---|
| Pass | Fingerprint matches, files complete | Load normally |
| Missing seal | File exists but fingerprint not embedded | Embed fingerprint before publishing |
| Drift | Content updated but not re-signed | Regenerate fingerprint and update manifest |
| Alarm | Fingerprint and content disagree | Stop loading, flag as suspected tampering |

## Update Principles

- Any change to core content requires a new fingerprint
- New versions must record in `manifest.json`: `fingerprint`, `previous_fingerprint`, `issued_at`, `fingerprint_version`
- The soul fingerprint verifies authenticity; it does not replace the consent protocol
- Having a fingerprint does not mean having authorization — fingerprint AND consent must both hold for a Relic to go live

## Minimal Example

```json
{
  "name": "grandma-relic",
  "fingerprint": "relic:sha256:8f0d7d0f1f5d6a8a3f5a1d1d9f2d7c3b8a4c6e7f0d1a2b3c4d5e6f7081920abc",
  "previous_fingerprint": null,
  "issued_at": "2026-03-01T00:00:00Z",
  "fingerprint_version": "1.0"
}
```
