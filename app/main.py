import os, re, subprocess, tempfile
from pathlib import Path
from urllib.parse import urlparse
import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

BASE = Path(__file__).resolve().parent
MAX_BYTES = int(os.getenv("MAX_SOURCE_BYTES", "2000000"))

app = FastAPI(title="CF Worker Obfuscator", version="1.0.0")
app.mount("/static", StaticFiles(directory=BASE/"static"), name="static")
templates = Jinja2Templates(directory=str(BASE/"templates"))

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/health")
async def health():
    return {"ok": True, "service": "cf-worker-obfuscator"}

def valid_source_url(url: str) -> bool:
    p = urlparse(url)
    return p.scheme == "https" and p.netloc in {
        "raw.githubusercontent.com", "github.com", "gist.githubusercontent.com"
    }

async def download_source(url: str) -> str:
    if not valid_source_url(url):
        raise HTTPException(400, "Only HTTPS GitHub/Gist source URLs are allowed.")
    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        r = await client.get(url, headers={"User-Agent":"CF-Worker-Obfuscator/1.0"})
    if r.status_code != 200:
        raise HTTPException(400, f"Source download failed: HTTP {r.status_code}")
    if len(r.content) > MAX_BYTES:
        raise HTTPException(413, "Source file is too large.")
    try:
        return r.content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(400, "Source is not valid UTF-8 JavaScript.")

def run_engine(source: str, opts: dict) -> str:
    if len(source.encode()) > MAX_BYTES:
        raise HTTPException(413, "Source file is too large.")

    with tempfile.TemporaryDirectory() as td:
        src = Path(td)/"input.js"
        out = Path(td)/"output.js"
        src.write_text(source, encoding="utf-8")

        cmd = ["node", str(BASE/"obfuscate.cjs"), str(src), str(out), json_dumps(opts)]
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if p.returncode != 0:
            msg = (p.stderr or p.stdout or "Obfuscation failed").strip()
            raise HTTPException(422, msg[-5000:])
        result = out.read_text(encoding="utf-8")
        if not result.strip():
            raise HTTPException(422, "Obfuscator produced an empty file.")
        return result

def json_dumps(x):
    import json
    return json.dumps(x, separators=(",", ":"))

@app.post("/api/obfuscate")
async def obfuscate(
    url: str = Form(""),
    source: str = Form(""),
    file: UploadFile | None = File(None),
    identifier_names: bool = Form(True),
    string_array: bool = Form(True),
    string_encoding: str = Form("base64"),
    dead_code: bool = Form(True),
    control_flow: bool = Form(False),
    self_defending: bool = Form(False),
    disable_console: bool = Form(False),
    compact: bool = Form(True),
):
    if file and file.filename:
        raw = await file.read()
        if len(raw) > MAX_BYTES:
            raise HTTPException(413, "Source file is too large.")
        try:
            source = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(400, "Uploaded file is not UTF-8 JavaScript.")
    elif url.strip():
        source = await download_source(url.strip())
    elif source.strip():
        source = source
    else:
        raise HTTPException(400, "Provide a URL, upload a file, or paste source.")

    # Basic source sanity check before sending it to the JS engine.
    if not re.search(r"(function|const|let|var|class|export|import|=>|fetch|addEventListener)", source):
        raise HTTPException(422, "The input does not look like JavaScript.")

    opts = {
        "identifierNames": identifier_names,
        "stringArray": string_array,
        "stringEncoding": string_encoding,
        "deadCode": dead_code,
        "controlFlow": control_flow,
        "selfDefending": self_defending,
        "disableConsole": disable_console,
        "compact": compact,
    }
    result = run_engine(source, opts)

    return JSONResponse({
        "ok": True,
        "originalBytes": len(source.encode()),
        "outputBytes": len(result.encode()),
        "originalLines": source.count("\n")+1,
        "outputLines": result.count("\n")+1,
        "output": result,
        "filename": (Path(file.filename).stem if file and file.filename else "worker") + ".obfuscated.js",
    })
