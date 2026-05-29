$ErrorActionPreference = "Stop"

function Import-EnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or $line -notmatch "^\s*([^=]+?)\s*=\s*(.*)\s*$") {
            return
        }

        $name = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"').Trim("'")

        if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Import-EnvFile (Join-Path $root ".env")
Import-EnvFile (Join-Path $root ".env.local")

if (-not $env:SUPABASE_DB_URL) {
    throw "Missing SUPABASE_DB_URL. Add it to .env.local to apply migrations with Supabase CLI."
}

supabase db push --db-url $env:SUPABASE_DB_URL --include-all
