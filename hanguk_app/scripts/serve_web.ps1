# Tiny static file server for the Flutter web release build.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\serve_web.ps1
$port = 8080
$root = Join-Path $PSScriptRoot "..\build\web"
$root = (Resolve-Path $root).Path

if (-not (Test-Path $root)) {
  Write-Error "Build dir not found: $root. Run 'flutter build web --release' first."
  exit 1
}

$mime = @{
  ".html"    = "text/html; charset=utf-8"
  ".htm"     = "text/html; charset=utf-8"
  ".js"      = "application/javascript; charset=utf-8"
  ".mjs"     = "application/javascript; charset=utf-8"
  ".css"     = "text/css; charset=utf-8"
  ".json"    = "application/json; charset=utf-8"
  ".wasm"    = "application/wasm"
  ".png"     = "image/png"
  ".jpg"     = "image/jpeg"
  ".jpeg"    = "image/jpeg"
  ".gif"     = "image/gif"
  ".svg"     = "image/svg+xml"
  ".ico"     = "image/x-icon"
  ".woff"    = "font/woff"
  ".woff2"   = "font/woff2"
  ".ttf"     = "font/ttf"
  ".otf"     = "font/otf"
  ".webmanifest" = "application/manifest+json"
  ".map"     = "application/json"
  ".dat"     = "application/octet-stream"
  ".bin"     = "application/octet-stream"
}

# In-memory token buffer used as a one-shot backchannel between browser tabs
# (so the Supabase Studio tab can hand its access_token to the localhost tab,
# which is same-origin to this server). Deploys-only; cleared after read.
$script:tokenBuffer = $null

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Output "Serving $root on http://127.0.0.1:$port (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')

    # Backchannel endpoints (same-origin to localhost tab; CORS-allowed for cross-origin POST from supabase.com)
    if ($req.HttpMethod -eq 'OPTIONS') {
      $res.Headers.Add("Access-Control-Allow-Origin", "*")
      $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
      $res.Headers.Add("Access-Control-Allow-Private-Network", "true")
      $res.Headers.Add("Access-Control-Max-Age", "600")
      $res.StatusCode = 204
      $res.OutputStream.Close()
      Write-Output "204 OPTIONS $rel"
      continue
    }

    if ($rel -eq '__upload_token__' -and $req.HttpMethod -eq 'POST') {
      $reader = New-Object System.IO.StreamReader($req.InputStream)
      $script:tokenBuffer = $reader.ReadToEnd()
      $reader.Close()
      $res.Headers.Add("Access-Control-Allow-Origin", "*")
      $res.Headers.Add("Access-Control-Allow-Private-Network", "true")
      $res.ContentType = "application/json"
      $bytes = [Text.Encoding]::UTF8.GetBytes('{"ok":true}')
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.OutputStream.Close()
      Write-Output "200 POST __upload_token__ ($($script:tokenBuffer.Length) bytes)"
      continue
    }

    if ($rel -eq '__get_token__' -and $req.HttpMethod -eq 'GET') {
      $res.Headers.Add("Access-Control-Allow-Origin", "*")
      $res.Headers.Add("Cache-Control", "no-store")
      $res.ContentType = "text/plain; charset=utf-8"
      $payload = if ($script:tokenBuffer) { $script:tokenBuffer } else { "" }
      $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.OutputStream.Close()
      Write-Output "200 GET __get_token__ ($($bytes.Length) bytes)"
      continue
    }

    if ([string]::IsNullOrEmpty($rel)) { $rel = "index.html" }
    $path = Join-Path $root $rel
    if ((Test-Path $path -PathType Container)) { $path = Join-Path $path "index.html" }
    if (-not (Test-Path $path -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $res.ContentType = "text/plain; charset=utf-8"
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.OutputStream.Close()
      Write-Output "404 $rel"
      continue
    }
    $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
    $ct = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
    $res.ContentType = $ct
    # Disable aggressive caching so reloads pick up rebuilds
    $res.Headers.Add("Cache-Control", "no-store")
    # Required for CanvasKit's SharedArrayBuffer / cross-origin isolation
    $res.Headers.Add("Cross-Origin-Embedder-Policy", "require-corp")
    $res.Headers.Add("Cross-Origin-Opener-Policy", "same-origin")
    # Allow cross-origin fetch (used by tooling to drop function source into the browser)
    $res.Headers.Add("Access-Control-Allow-Origin", "*")
    # Chrome's "Private Network Access" requires this header when a public
    # origin (e.g. supabase.com) fetches a localhost resource.
    $res.Headers.Add("Access-Control-Allow-Private-Network", "true")
    try {
      $bytes = [IO.File]::ReadAllBytes($path)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Output "200 $rel ($($bytes.Length) bytes)"
    } catch {
      $res.StatusCode = 500
      Write-Output "500 $rel : $_"
    } finally {
      $res.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
