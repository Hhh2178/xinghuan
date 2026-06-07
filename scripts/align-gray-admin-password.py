import hashlib
import os
import random
import string
import subprocess
import tempfile
from pathlib import Path


ENV_PATH = Path("/opt/apps/xinghuan-canvas-next/shared/canvas-next.env")


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value
    return env


def main() -> None:
    env = load_env(ENV_PATH)
    password = env["XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD"]
    database_url = env["XINGHUAN_DATABASE_URL"]
    salt = "".join(random.choice(string.hexdigits.lower()[:16]) for _ in range(32))
    key = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
    encoded = f"scrypt${salt}${key}"

    sql = (
        "update xh_users "
        f"set password_hash = '{encoded}', updated_at = now() "
        "where role = 'admin';\n"
    )

    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8", suffix=".sql") as handle:
        handle.write(sql)
        sql_path = handle.name

    try:
        subprocess.run(["psql", database_url, "-f", sql_path], check=True)
        print("aligned")
    finally:
        try:
            os.remove(sql_path)
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    main()
