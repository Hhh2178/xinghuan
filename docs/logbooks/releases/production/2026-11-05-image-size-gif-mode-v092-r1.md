# Starflow Production: configurable image sizes and GIF mode

- Date: 2026-11-05
- Target: Starflow Production, `canvas.starflow.xin`
- Version: `0.9.2`
- Release: `20261105-image-size-gif-mode-v092-r1`
- Source commit: `468e6b5752438a223f20b190fc51a8a315f77456`
- Encrypted runtime archive SHA-256: `7ca5cc9ae8bd514e5c8acb299cc1ffd5fd13b50e707f4933969ccf26ecb195df`
- Plaintext runtime archive SHA-256: `1b8ee8a704fd3533436cfff4b584b60bd2954609ef634fb53a5de8f0f7784f1d`
- Database: `xinghuan_canvas_next`

This release adds administrator-managed model image-output settings, exact-pixel dimensions, and a model-enabled GIF mode. The API validates and freezes capability settings into queued tasks; Worker revalidates from the task snapshot. GIF reference images are forwarded when enabled, including for APIMart GPT-Image-2.6 as an explicit upstream trial.

Production API and Worker are active. Internal and public status report `0.9.2 / production`; permission mode is enforced. Permission readiness passed with 193 subjects, 2,614 rules, 11 principals, and 0 failures. Gray remains decommissioned, and Zezhen targets were not changed.

The official APIMart GIF image-to-image behavior was not exercised with a real paid generation request. If the upstream rejects GIF references, the user sees that upstream error; references are not stripped and retried.

See `../../validations/2026-11-05-image-size-gif-mode-v092-r1.md` for build, package, deployment, and runtime evidence.
