# Starflow Production: APIMart legacy GIF size compatibility

- Date: 2026-11-05
- Target: Starflow Production, `canvas.starflow.xin`
- Version: `0.9.3`
- Release: `20261105-apimart-gif-size-compat-v093-r1`
- Source commit: `cdd15dd0e65e7d86572d3924a7b42de2a5b54d77`
- Encrypted runtime archive SHA-256: `25fd3aef6af5ebb60818a12105d42cde32fd4f917986bb115c4312bcdbdc4da8`
- Plaintext runtime archive SHA-256: `0088ea727f343cd662fe1753177fff1cabc2d9a8bff46943f18456b2db4a1365`
- Database: `xinghuan_canvas_next`

This compatibility release fixes the APIMart GIF request builder so historical queued payloads retain their `size` field when the newer `imageOutputConfig` snapshot is absent. The resolved size uses `gif_size`, legacy `size`, an existing body size, then the model default.

The release was deployed to Starflow Production. The deploy applied no pending database migrations and restarted API and Worker. Runtime verification reported API and Worker active, internal and public status `0.9.3 / production`, enforced permission mode, and readiness with 193 subjects, 2,614 rules, 11 principals, and 0 failures. Starflow Gray remains decommissioned; Zezhen targets were not changed.

The original GPT-Image-2.6 configurable dimensions and GIF mode are included from the `0.9.2` release. No paid APIMart generation request was made; GIF image-to-image acceptance by the upstream remains unverified.

See `../../validations/2026-11-05-apimart-gif-size-compat-v093-r1.md` for package, checks, deployment, and runtime evidence.
