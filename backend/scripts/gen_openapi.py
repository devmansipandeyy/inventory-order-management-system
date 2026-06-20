import json
import pathlib

from app.main import app

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = app.openapi()

openapi_path = ROOT / "backend" / "openapi.json"
openapi_path.write_text(json.dumps(spec, indent=2) + "\n")

paths = spec.get("paths", {})
rows = []
for path in sorted(paths):
    for method, op in paths[path].items():
        tag = (op.get("tags") or ["-"])[0]
        summary = op.get("summary") or op.get("operationId", "")
        rows.append((tag, method.upper(), path, summary))

rows.sort(key=lambda r: (r[0], r[2], r[1]))

lines = [
    "# API reference",
    "",
    f"Auto-generated from the FastAPI OpenAPI schema ({spec['info']['title']} v{spec['info']['version']}).",
    "Live interactive docs: `/docs` (Swagger UI) and `/redoc`. Raw schema: `/openapi.json`.",
    "",
    f"**{len(rows)} endpoints** across {len(paths)} paths.",
    "",
    "| Group | Method | Path | Summary |",
    "| --- | --- | --- | --- |",
]
for tag, method, path, summary in rows:
    lines.append(f"| {tag} | `{method}` | `{path}` | {summary} |")

docs_dir = ROOT / "docs"
docs_dir.mkdir(exist_ok=True)
(docs_dir / "API.md").write_text("\n".join(lines) + "\n")

print(f"wrote backend/openapi.json and docs/API.md ({len(rows)} endpoints)")
