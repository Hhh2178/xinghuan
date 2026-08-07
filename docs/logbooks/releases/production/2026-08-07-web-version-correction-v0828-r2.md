# Web 版本显示修正 v0.8.28 Production

- release: `20260807-web-version-correction-v0828-r2`
- target: old-server Production (`canvas.hhh2121.xyz`)
- source commit: `19d13286b9a710456433908c59da98effae380e0`
- encrypted archive SHA-256: `ff527ffbfa596838ae60df84b6ea67e85ffa6fe87f13a7f759760034e5f0a838`
- plaintext archive SHA-256: `17b57cc2d7573616293d0bcb83343dda3cf99a1872b15282ec328cabc241f821`
- reason: the previous v0.8.28 server release exposed API v0.8.28 but carried a stale Web bundle compiled with v0.8.27.

## Result

- Rebuilt Web/Admin/API/Worker single-port artifacts from the v0.8.28 source tree.
- Added a release gate that checks the Web entry bundle against the root package version before packaging and again inside the archive.
- Deployed the AES-256-GCM sealed runtime to old Production; no database migration was required.
- Gray and new-server environments remain on the already validated `20260807-parallel-group-supervision-v0828-r1` release.
