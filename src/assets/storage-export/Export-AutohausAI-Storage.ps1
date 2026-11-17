#Requires -Version 5.1
<#
.SYNOPSIS
Read-only Autohaus.ai storage export for authorised administrators.

.DESCRIPTION
Without -Download or -TestOnly this script only creates and reconciles manifests.
-TestOnly downloads one public and one private file and exercises interrupted resume.
-Download is required for a package or full download. No cloud object is modified.
#>
[CmdletBinding()]
param(
    [string]$FunctionUrl = '__AUTOHAUS_STORAGE_EXPORT_URL__',
    [string]$Destination = (Join-Path $PWD 'AutohausAI-Storage-Export'),
    [string]$ExportId,
    [switch]$Download,
    [switch]$TestOnly,
    [switch]$VerifyOnly,
    [switch]$Rescan,
    [int[]]$Package,
    [int]$PackageSizeMB = 500,
    [int]$PackageFileLimit = 250,
    [switch]$AllowLocalReplace
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http

$script:FunctionUrl = $FunctionUrl.TrimEnd('/')
$script:ExportId = $ExportId
$script:ExportSecret = $null
$script:Root = [IO.Path]::GetFullPath($Destination)
$script:ManifestDir = Join-Path $script:Root 'manifest'
$script:PackageDir = Join-Path $script:ManifestDir 'packages'
$script:ScanFilesPath = Join-Path $script:ManifestDir 'scan-files.jsonl'
$script:FilesPath = Join-Path $script:ManifestDir 'files.jsonl'
$script:StatePath = Join-Path $script:ManifestDir 'scan-state.json'
$script:DownloadStatePath = Join-Path $script:ManifestDir 'download-state.jsonl'
$script:SignedUrlLifetimeSkew = 30

function Write-Step([string]$Message) {
    Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Message)
}

function New-DirectoryIfMissing([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        [void][IO.Directory]::CreateDirectory($Path)
    }
}

function Write-JsonFile([string]$Path, $Value) {
    $temporary = "$Path.tmp"
    [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Append-JsonLine([string]$Path, $Value) {
    $line = $Value | ConvertTo-Json -Depth 12 -Compress
    [IO.File]::AppendAllText($Path, $line + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
}

function Read-JsonLines([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $reader = [IO.File]::OpenText($Path)
    try {
        while (-not $reader.EndOfStream) {
            $line = $reader.ReadLine()
            if (-not [string]::IsNullOrWhiteSpace($line)) {
                ConvertFrom-Json $line
            }
        }
    } finally {
        $reader.Dispose()
    }
}

function Read-SecretText {
    $secure = Read-Host 'Exportsitzungs-Secret (wird nicht gespeichert)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Invoke-ExportApi([string]$Action, [hashtable]$Payload = @{}) {
    $body = @{
        action = $Action
        exportId = $script:ExportId
        exportSecret = $script:ExportSecret
    }
    foreach ($key in $Payload.Keys) { $body[$key] = $Payload[$key] }
    $json = $body | ConvertTo-Json -Depth 12 -Compress
    for ($attempt = 1; $attempt -le 6; $attempt++) {
        try {
            return Invoke-RestMethod -Method Post -Uri $script:FunctionUrl -ContentType 'application/json; charset=utf-8' `
                -Body $json -TimeoutSec 180 -UseBasicParsing
        } catch {
            $status = 0
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                $status = [int]$_.Exception.Response.StatusCode
            }
            $retryable = $status -eq 0 -or $status -eq 408 -or $status -eq 429 -or $status -ge 500
            if (-not $retryable -or $attempt -eq 6) {
                throw ("Exportdienst: {0} fehlgeschlagen (HTTP {1})." -f $Action, $status)
            }
            Start-Sleep -Seconds ([Math]::Min(30, [Math]::Pow(2, $attempt)) + (Get-Random -Maximum 3))
        }
    }
}

function Get-FileKey([string]$Bucket, [string]$Path) {
    return $Bucket + "`n" + $Path
}

function Normalize-ETag($Value) {
    if ($null -eq $Value) { return $null }
    $text = ([string]$Value).Trim()
    if ($text.StartsWith('W/')) { $text = $text.Substring(2) }
    $text = $text.Trim('"')
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    return $text
}

function Test-WindowsName([string]$Name) {
    if ([string]::IsNullOrEmpty($Name) -or $Name -eq '.' -or $Name -eq '..') { return $false }
    if ($Name.EndsWith(' ') -or $Name.EndsWith('.')) { return $false }
    if ($Name.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0) { return $false }
    if ($Name -match '^(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)') { return $false }
    return $true
}

function Get-RelativeLocalPath([string]$Bucket, [string]$Path) {
    if (-not (Test-WindowsName $Bucket)) {
        throw ("Bucketname ist unter Windows nicht originalgetreu abbildbar: {0}" -f $Bucket)
    }
    $segments = $Path -split '/'
    foreach ($segment in $segments) {
        if (-not (Test-WindowsName $segment)) {
            throw ("Objektpfad ist unter Windows nicht originalgetreu abbildbar: {0}/{1}" -f $Bucket, $Path)
        }
    }
    $relative = Join-Path $Bucket ($segments -join '\')
    $full = Join-Path $script:Root $relative
    if ($full.Length -ge 30000) {
        throw ("Objektpfad überschreitet auch die erweiterte Windows-Pfadlänge: {0}" -f $relative)
    }
    return $relative
}

function Get-FullLocalPath([string]$RelativePath) {
    $full = [IO.Path]::GetFullPath((Join-Path $script:Root $RelativePath))
    if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT -and $full.Length -ge 240 -and -not $full.StartsWith('\\?\')) {
        [AppContext]::SetSwitch('Switch.System.IO.UseLegacyPathHandling', $false)
        [AppContext]::SetSwitch('Switch.System.IO.BlockLongPaths', $false)
        return '\\?\' + $full
    }
    return $full
}

function Get-HashForFile([string]$Path, [string]$Algorithm) {
    $hasher = [Security.Cryptography.HashAlgorithm]::Create($Algorithm)
    $stream = [IO.File]::OpenRead($Path)
    try {
        return ([BitConverter]::ToString($hasher.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    } finally {
        $stream.Dispose()
        $hasher.Dispose()
    }
}

function Get-BucketInventory {
    Write-Step 'Buckets aus Storage-API und Datenbank lesen …'
    $response = Invoke-ExportApi 'list_buckets'
    $databaseById = @{}
    foreach ($bucket in @($response.databaseBuckets)) { $databaseById[$bucket.id] = $bucket }
    $apiById = @{}
    foreach ($bucket in @($response.buckets)) { $apiById[$bucket.id] = $bucket }
    $ids = @($apiById.Keys + $databaseById.Keys | Sort-Object -Unique)
    $result = @()
    foreach ($id in $ids) {
        $api = $apiById[$id]
        $database = $databaseById[$id]
        $result += [pscustomobject]@{
            Id = $id
            ApiPresent = ($null -ne $api)
            DatabasePresent = ($null -ne $database)
            IsPublic = if ($null -ne $api) { [bool]$api.public } else { [bool]$database.is_public }
            ApiCreatedAt = if ($null -ne $api) { $api.createdAt } else { $null }
            DatabaseCreatedAt = if ($null -ne $database) { $database.created_at } else { $null }
        }
    }
    $result | Export-Csv -LiteralPath (Join-Path $script:ManifestDir 'buckets.csv') -NoTypeInformation -Encoding UTF8
    Write-JsonFile (Join-Path $script:ManifestDir 'buckets.json') $result
    return $result
}

function Save-ScanCheckpoint($Pending, [string]$Status) {
    Write-JsonFile $script:StatePath @{
        status = $Status
        savedAt = (Get-Date).ToUniversalTime().ToString('o')
        pending = @($Pending)
    }
}

function Scan-ApiFiles($Buckets, [bool]$ResumeScan) {
    $queue = New-Object 'System.Collections.Generic.List[object]'
    $reuseCompletedScan = $false
    if ($ResumeScan -and (Test-Path -LiteralPath $script:StatePath) -and (Test-Path -LiteralPath $script:ScanFilesPath)) {
        $state = Get-Content -LiteralPath $script:StatePath -Raw | ConvertFrom-Json
        if ($state.status -eq 'scanning') {
            foreach ($item in @($state.pending)) { $queue.Add($item) }
            Write-Step ("Unterbrochenen Scan mit {0} offenen Ordnern fortsetzen …" -f $queue.Count)
        } elseif ($state.status -eq 'api_scan_complete') {
            $reuseCompletedScan = $true
            Write-Step 'Abgeschlossenen API-Scan für den erneuten lokalen Abgleich wiederverwenden …'
        }
    }
    if ($queue.Count -eq 0 -and -not $reuseCompletedScan) {
        [IO.File]::WriteAllText($script:ScanFilesPath, '', (New-Object Text.UTF8Encoding($false)))
        foreach ($bucket in $Buckets) {
            $queue.Add([pscustomobject]@{ bucket = $bucket.Id; prefix = ''; offset = 0; isPublic = $bucket.IsPublic })
        }
    }
    while ($queue.Count -gt 0) {
        $work = $queue[0]
        $queue.RemoveAt(0)
        $offset = [int]$work.offset
        do {
            $page = Invoke-ExportApi 'scan_page' @{ bucket = $work.bucket; prefix = $work.prefix; offset = $offset; limit = 1000 }
            $entries = @($page.entries)
            foreach ($entry in $entries) {
                if ($entry.isFolder) {
                    $queue.Add([pscustomobject]@{ bucket = $work.bucket; prefix = $entry.path; offset = 0; isPublic = $work.isPublic })
                } else {
                    Append-JsonLine $script:ScanFilesPath ([pscustomobject]@{
                        Bucket = $work.bucket
                        Path = $entry.path
                        Size = [int64]$entry.size
                        MimeType = $entry.mimetype
                        ETag = $entry.etag
                        ObjectId = $entry.id
                        CreatedAt = $entry.createdAt
                        UpdatedAt = $entry.updatedAt
                        IsPublic = [bool]$work.isPublic
                    })
                }
            }
            $offset += $entries.Count
            $pending = @()
            if ($entries.Count -eq [int]$page.limit) {
                $pending += [pscustomobject]@{ bucket = $work.bucket; prefix = $work.prefix; offset = $offset; isPublic = $work.isPublic }
            }
            $pending += @($queue.ToArray())
            Save-ScanCheckpoint $pending 'scanning'
        } while ($entries.Count -eq [int]$page.limit -and $entries.Count -gt 0)
    }
    Save-ScanCheckpoint @() 'api_scan_complete'
    $unique = @{}
    foreach ($file in @(Read-JsonLines $script:ScanFilesPath)) {
        $unique[(Get-FileKey $file.Bucket $file.Path)] = $file
    }
    return $unique.Values | Sort-Object Bucket, Path
}

function Get-DatabaseFiles([string]$Bucket, [bool]$IsPublic) {
    $offset = 0
    do {
        $page = Invoke-ExportApi 'db_inventory_page' @{ bucket = $Bucket; offset = $offset; limit = 1000 }
        $entries = @($page.entries)
        foreach ($entry in $entries) {
            [pscustomobject]@{
                Bucket = $Bucket
                Path = $entry.name
                Size = [int64]$entry.size_bytes
                MimeType = $entry.mimetype
                ETag = (Normalize-ETag $entry.etag)
                ObjectId = $entry.id
                CreatedAt = $entry.created_at
                UpdatedAt = $entry.updated_at
                IsPublic = $IsPublic
            }
        }
        $offset += $entries.Count
    } while ($entries.Count -eq 1000)
}

function Merge-Inventory($ApiFiles, $Buckets) {
    $apiByKey = @{}
    foreach ($file in @($ApiFiles)) { $apiByKey[(Get-FileKey $file.Bucket $file.Path)] = $file }
    $databaseByKey = @{}
    foreach ($bucket in $Buckets) {
        Write-Step ("Datenbankabgleich: {0}" -f $bucket.Id)
        foreach ($file in @(Get-DatabaseFiles $bucket.Id $bucket.IsPublic)) {
            $databaseByKey[(Get-FileKey $file.Bucket $file.Path)] = $file
        }
    }
    $keys = @($apiByKey.Keys + $databaseByKey.Keys | Sort-Object -Unique)
    $merged = @()
    foreach ($key in $keys) {
        $api = $apiByKey[$key]
        $database = $databaseByKey[$key]
        $source = if ($null -ne $api) { $api } else { $database }
        $status = 'matched'
        if ($null -eq $api) { $status = 'database_only' }
        elseif ($null -eq $database) { $status = 'api_only' }
        elseif ([int64]$api.Size -ne [int64]$database.Size) { $status = 'size_mismatch' }
        elseif ($api.ObjectId -and $database.ObjectId -and $api.ObjectId -ne $database.ObjectId) { $status = 'id_mismatch' }
        elseif ($api.ETag -and $database.ETag -and $api.ETag -ne $database.ETag) { $status = 'etag_mismatch' }
        $merged += [pscustomobject]@{
            Bucket = $source.Bucket
            Path = $source.Path
            Size = [int64]$source.Size
            MimeType = $source.MimeType
            ETag = $source.ETag
            ObjectId = $source.ObjectId
            CreatedAt = $source.CreatedAt
            UpdatedAt = $source.UpdatedAt
            IsPublic = [bool]$source.IsPublic
            DatabaseStatus = $status
            ApiSize = if ($null -ne $api) { [int64]$api.Size } else { $null }
            DatabaseSize = if ($null -ne $database) { [int64]$database.Size } else { $null }
            Package = 0
            LocalPath = (Get-RelativeLocalPath $source.Bucket $source.Path)
        }
    }
    return $merged | Sort-Object Bucket, Path
}

function Write-CompleteManifest($Files, $Buckets, $PreviousFiles) {
    $packageNumber = 1
    $packageBytes = [int64]0
    $packageCount = 0
    $maxBytes = [int64]$PackageSizeMB * 1MB
    foreach ($file in $Files) {
        if ($packageCount -gt 0 -and ($packageCount -ge $PackageFileLimit -or ($packageBytes + [int64]$file.Size) -gt $maxBytes)) {
            $packageNumber++
            $packageBytes = 0
            $packageCount = 0
        }
        $file.Package = $packageNumber
        $packageBytes += [int64]$file.Size
        $packageCount++
    }
    [IO.File]::WriteAllText($script:FilesPath, '', (New-Object Text.UTF8Encoding($false)))
    foreach ($file in $Files) { Append-JsonLine $script:FilesPath $file }
    $Files | Export-Csv -LiteralPath (Join-Path $script:ManifestDir 'files.csv') -NoTypeInformation -Encoding UTF8

    Get-ChildItem -LiteralPath $script:PackageDir -Filter 'package-*.json' -ErrorAction SilentlyContinue | ForEach-Object {
        # Only generated local package manifests are replaced; cloud files are never touched.
        [IO.File]::Delete($_.FullName)
    }
    for ($number = 1; $number -le $packageNumber; $number++) {
        $packageFiles = @($Files | Where-Object { $_.Package -eq $number })
        if ($packageFiles.Count -eq 0) { continue }
        Write-JsonFile (Join-Path $script:PackageDir ('package-{0:D4}.json' -f $number)) ([pscustomobject]@{
            package = $number
            fileCount = $packageFiles.Count
            totalBytes = ($packageFiles | Measure-Object -Property Size -Sum).Sum
            files = $packageFiles
        })
    }

    if ($null -ne $PreviousFiles) {
        $oldByKey = @{}
        $newByKey = @{}
        foreach ($file in @($PreviousFiles)) { $oldByKey[(Get-FileKey $file.Bucket $file.Path)] = $file }
        foreach ($file in $Files) { $newByKey[(Get-FileKey $file.Bucket $file.Path)] = $file }
        $allKeys = @($oldByKey.Keys + $newByKey.Keys | Sort-Object -Unique)
        $delta = foreach ($key in $allKeys) {
            $old = $oldByKey[$key]
            $new = $newByKey[$key]
            $status = 'unchanged'
            if ($null -eq $old) { $status = 'new' }
            elseif ($null -eq $new) { $status = 'missing_remotely_local_retained' }
            elseif ($old.Size -ne $new.Size -or $old.ETag -ne $new.ETag -or $old.UpdatedAt -ne $new.UpdatedAt) { $status = 'changed' }
            if ($status -ne 'unchanged') {
                $item = if ($null -ne $new) { $new } else { $old }
                [pscustomobject]@{ Bucket = $item.Bucket; Path = $item.Path; Status = $status; OldSize = $old.Size; NewSize = $new.Size }
            }
        }
        @($delta) | Export-Csv -LiteralPath (Join-Path $script:ManifestDir 'delta-report.csv') -NoTypeInformation -Encoding UTF8
    }

    $totalBytes = ($Files | Measure-Object -Property Size -Sum).Sum
    if ($null -eq $totalBytes) { $totalBytes = 0 }
    $summary = [pscustomobject]@{
        scanCompletedAt = (Get-Date).ToUniversalTime().ToString('o')
        expectedBucketCount = 9
        bucketCount = @($Buckets).Count
        fileCount = @($Files).Count
        totalBytes = [int64]$totalBytes
        packageCount = $packageNumber
        reconciliationMismatchCount = @($Files | Where-Object { $_.DatabaseStatus -ne 'matched' }).Count
        downloadStarted = $false
        note = 'Storage ist kein atomarer Snapshot. Mit -Rescan und delta-report.csv spätere Änderungen prüfen.'
    }
    Write-JsonFile (Join-Path $script:ManifestDir 'manifest-complete.json') $summary
    Save-ScanCheckpoint @() 'complete'
    return $summary
}

function New-OrUpdateManifest {
    New-DirectoryIfMissing $script:ManifestDir
    New-DirectoryIfMissing $script:PackageDir
    $completePath = Join-Path $script:ManifestDir 'manifest-complete.json'
    if ((Test-Path -LiteralPath $completePath) -and -not $Rescan) {
        Write-Step 'Vorhandenes vollständiges Manifest wird verwendet (-Rescan erzeugt einen Delta-Abgleich).'
        return
    }
    $previous = $null
    if ($Rescan -and (Test-Path -LiteralPath $script:FilesPath)) {
        $previous = @(Read-JsonLines $script:FilesPath)
    }
    $resumeScan = (Test-Path -LiteralPath $script:StatePath) -and -not $Rescan
    $buckets = @(Get-BucketInventory)
    if ($buckets.Count -ne 9) {
        Write-Warning ("Es wurden {0} statt der erwarteten 9 Buckets gefunden. Die Abweichung steht im Manifest." -f $buckets.Count)
    }
    $apiFiles = @(Scan-ApiFiles $buckets $resumeScan)
    $files = @(Merge-Inventory $apiFiles $buckets)
    $summary = Write-CompleteManifest $files $buckets $previous
    Write-Step ("Manifest vollständig: {0} Dateien, {1:N1} GB, {2} Pakete." -f $summary.fileCount, ($summary.totalBytes / 1GB), $summary.packageCount)
}

function Get-DownloadState {
    $states = @{}
    foreach ($state in @(Read-JsonLines $script:DownloadStatePath)) {
        if ($state.status -eq 'complete') { $states[$state.key] = $state }
    }
    return $states
}

function Get-Integrity([string]$Path, [string]$ETag) {
    $sha = Get-HashForFile $Path 'SHA256'
    $md5 = $null
    $sourceStatus = 'unavailable'
    if ($ETag -match '^[0-9a-fA-F]{32}$') {
        $md5 = Get-HashForFile $Path 'MD5'
        $sourceStatus = if ($md5 -eq $ETag.ToLowerInvariant()) { 'md5_match' } else { 'md5_mismatch' }
    }
    return [pscustomobject]@{ Sha256 = $sha; Md5 = $md5; SourceChecksumStatus = $sourceStatus }
}

function Test-CompletedFile($File, $States) {
    $key = Get-FileKey $File.Bucket $File.Path
    if (-not $States.ContainsKey($key)) { return $false }
    $state = $States[$key]
    if ($state.updatedAt -ne $File.UpdatedAt -or [int64]$state.size -ne [int64]$File.Size) { return $false }
    $full = Get-FullLocalPath $File.LocalPath
    if (-not (Test-Path -LiteralPath $full)) { return $false }
    $item = Get-Item -LiteralPath $full
    if ([int64]$item.Length -ne [int64]$File.Size) { return $false }
    $sha = Get-HashForFile $full 'SHA256'
    return $sha -eq $state.sha256
}

function Receive-RemoteFile($File, [string]$Url, [int64]$InterruptAfterBytes = 0) {
    $finalPath = Get-FullLocalPath $File.LocalPath
    $parent = Split-Path -Parent $finalPath
    New-DirectoryIfMissing $parent
    $partPath = $finalPath + '.part'
    if ((Test-Path -LiteralPath $finalPath) -and -not $AllowLocalReplace) {
        throw ("Lokale Datei existiert bereits und ist nicht als vollständig bestätigt: {0}" -f $File.LocalPath)
    }
    $offset = [int64]0
    if (Test-Path -LiteralPath $partPath) { $offset = (Get-Item -LiteralPath $partPath).Length }
    if ($offset -gt [int64]$File.Size) { throw ("Partdatei ist größer als das Quellobjekt: {0}" -f $File.LocalPath) }

    $client = New-Object Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromHours(2)
    try {
        $request = New-Object Net.Http.HttpRequestMessage([Net.Http.HttpMethod]::Get, $Url)
        if ($offset -gt 0) { $request.Headers.Range = New-Object Net.Http.Headers.RangeHeaderValue($offset, $null) }
        $response = $client.SendAsync($request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        $status = [int]$response.StatusCode
        if ($status -eq 416 -and $offset -eq [int64]$File.Size) {
            $response.Dispose(); $request.Dispose()
        } else {
            if ($offset -gt 0 -and $status -eq 200) {
                Write-Step 'Quelle unterstützt keinen Range-Resume; nur diese Datei wird neu geladen.'
                $offset = 0
            }
            if ($status -ne 200 -and $status -ne 206) {
                $response.Dispose(); $request.Dispose()
                throw ("HTTP_{0}" -f $status)
            }
            $source = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $fileMode = if ($offset -gt 0 -and $status -eq 206) { [IO.FileMode]::Append } else { [IO.FileMode]::Create }
            $target = New-Object IO.FileStream($partPath, $fileMode, [IO.FileAccess]::Write, [IO.FileShare]::None)
            $buffer = New-Object byte[] 65536
            $writtenThisRequest = [int64]0
            try {
                while (($read = $source.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $target.Write($buffer, 0, $read)
                    $writtenThisRequest += $read
                    if ($InterruptAfterBytes -gt 0 -and ($offset + $writtenThisRequest) -ge $InterruptAfterBytes) {
                        $target.Flush()
                        throw 'TEST_INTERRUPT'
                    }
                }
            } finally {
                $target.Dispose(); $source.Dispose(); $response.Dispose(); $request.Dispose()
            }
        }
    } finally {
        $client.Dispose()
    }

    $partLength = (Get-Item -LiteralPath $partPath).Length
    if ([int64]$partLength -ne [int64]$File.Size) {
        throw ("Unvollständige Datei: {0} von {1} Bytes." -f $partLength, $File.Size)
    }
    $integrity = Get-Integrity $partPath $File.ETag
    if ($integrity.SourceChecksumStatus -eq 'md5_mismatch') {
        throw ("Quellprüfsumme stimmt nicht überein: {0}" -f $File.LocalPath)
    }
    if (Test-Path -LiteralPath $finalPath) {
        $backup = Join-Path $script:Root (Join-Path 'local-conflicts' ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $File.LocalPath))
        New-DirectoryIfMissing (Split-Path -Parent $backup)
        Move-Item -LiteralPath $finalPath -Destination $backup
    }
    Move-Item -LiteralPath $partPath -Destination $finalPath
    return $integrity
}

function Save-CompletedFile($File, $Integrity) {
    $record = [pscustomobject]@{
        key = Get-FileKey $File.Bucket $File.Path
        bucket = $File.Bucket
        path = $File.Path
        localPath = $File.LocalPath
        size = [int64]$File.Size
        updatedAt = $File.UpdatedAt
        etag = $File.ETag
        sha256 = $Integrity.Sha256
        md5 = $Integrity.Md5
        sourceChecksumStatus = $Integrity.SourceChecksumStatus
        status = 'complete'
        completedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    Append-JsonLine $script:DownloadStatePath $record
    return $record
}

function Receive-WithRetries($File, $States) {
    if (Test-CompletedFile $File $States) {
        Write-Step ("Bereits geprüft, übersprungen: {0}" -f $File.LocalPath)
        return
    }
    for ($attempt = 1; $attempt -le 6; $attempt++) {
        try {
            $signed = Invoke-ExportApi 'sign' @{ files = @(@{ bucket = $File.Bucket; path = $File.Path }) }
            $url = @($signed.signed)[0].url
            $integrity = Receive-RemoteFile $File $url
            $record = Save-CompletedFile $File $integrity
            $States[(Get-FileKey $File.Bucket $File.Path)] = $record
            Write-Step ("Gesichert und geprüft: {0}" -f $File.LocalPath)
            return
        } catch {
            $message = $_.Exception.Message
            if ($message -eq 'TEST_INTERRUPT') { throw }
            if ($attempt -eq 6) { throw ("Download endgültig fehlgeschlagen für {0}: {1}" -f $File.LocalPath, $message) }
            Start-Sleep -Seconds ([Math]::Min(30, [Math]::Pow(2, $attempt)) + (Get-Random -Maximum 3))
        }
    }
}

function Start-TestExport($Files) {
    $publicFile = @($Files | Where-Object { $_.IsPublic -and [int64]$_.Size -gt 0 } | Sort-Object Size)[0]
    $privateFile = @($Files | Where-Object { -not $_.IsPublic -and [int64]$_.Size -gt 131072 } | Sort-Object Size)[0]
    if ($null -eq $publicFile -or $null -eq $privateFile) {
        throw 'Für den Test werden eine nichtleere öffentliche und eine private Datei mit mindestens 128 KiB benötigt.'
    }
    $states = Get-DownloadState
    Write-Step ("TEST: eine öffentliche Datei: {0}" -f $publicFile.LocalPath)
    Receive-WithRetries $publicFile $states

    Write-Step ("TEST: private Datei mit absichtlich unterbrochenem Download: {0}" -f $privateFile.LocalPath)
    if (-not (Test-CompletedFile $privateFile $states)) {
        $signed = Invoke-ExportApi 'sign' @{ files = @(@{ bucket = $privateFile.Bucket; path = $privateFile.Path }) }
        $url = @($signed.signed)[0].url
        try {
            [void](Receive-RemoteFile $privateFile $url 65536)
        } catch {
            if ($_.Exception.Message -notmatch 'TEST_INTERRUPT|Unvollständige Datei') { throw }
        }
        $partPath = Join-Path $script:Root ($privateFile.LocalPath + '.part')
        if (-not (Test-Path -LiteralPath $partPath)) { throw 'Der Test hat keine Partdatei für die Fortsetzung erzeugt.' }
        Write-Step 'Unterbrechung bestätigt; derselbe Download wird jetzt fortgesetzt.'
        Receive-WithRetries $privateFile $states
    }
    $report = @($publicFile, $privateFile) | ForEach-Object {
        [pscustomobject]@{
            bucket = $_.Bucket
            path = $_.Path
            localPath = $_.LocalPath
            size = $_.Size
            public = $_.IsPublic
            completed = Test-CompletedFile $_ $states
            resumedAfterInterruption = ($_.Path -eq $privateFile.Path)
        }
    }
    Write-JsonFile (Join-Path $script:ManifestDir 'test-report.json') $report
    if (@($report | Where-Object { -not $_.completed }).Count -gt 0) { throw 'Mindestens ein Testdownload ist nicht verifiziert.' }
    Write-Step 'TEST ERFOLGREICH: öffentliche Datei, private Datei und Fortsetzung sind verifiziert. Kein Volldownload gestartet.'
}

function Start-Download($Files) {
    $selected = @($Files)
    if ($Package -and $Package.Count -gt 0) {
        $selected = @($selected | Where-Object { $Package -contains $_.Package })
    }
    if ($selected.Count -eq 0) { throw 'Keine Dateien in den gewählten Paketen.' }
    $states = Get-DownloadState
    $groups = @($selected | Group-Object Package | Sort-Object { [int]$_.Name })
    foreach ($group in $groups) {
        Write-Step ("Paket {0}: {1} Dateien" -f $group.Name, $group.Count)
        foreach ($file in $group.Group) { Receive-WithRetries $file $states }
    }
    Write-Step 'Alle ausgewählten Pakete wurden verarbeitet. Bitte zusätzlich -VerifyOnly ausführen.'
}

function Test-ManifestFiles($Files) {
    $states = Get-DownloadState
    $report = foreach ($file in $Files) {
        $complete = Test-CompletedFile $file $states
        $full = Get-FullLocalPath $file.LocalPath
        $integrity = $null
        if (Test-Path -LiteralPath $full) { $integrity = Get-Integrity $full $file.ETag }
        [pscustomobject]@{
            Bucket = $file.Bucket
            Path = $file.Path
            LocalPath = $file.LocalPath
            ExpectedSize = $file.Size
            ActualSize = if (Test-Path -LiteralPath $full) { (Get-Item -LiteralPath $full).Length } else { $null }
            Sha256 = if ($null -ne $integrity) { $integrity.Sha256 } else { $null }
            SourceChecksumStatus = if ($null -ne $integrity) { $integrity.SourceChecksumStatus } else { 'not_downloaded' }
            Complete = $complete
            Package = $file.Package
        }
    }
    $report | Export-Csv -LiteralPath (Join-Path $script:ManifestDir 'verification-report.csv') -NoTypeInformation -Encoding UTF8
    $failed = @($report | Where-Object { -not $_.Complete -or $_.SourceChecksumStatus -eq 'md5_mismatch' })
    Write-Step ("Verifikation: {0} vollständig, {1} offen/fehlerhaft." -f (@($report).Count - $failed.Count), $failed.Count)
    if ($failed.Count -gt 0) { throw 'Die Verifikation ist nicht vollständig; Details stehen in verification-report.csv.' }
}

function Assert-Configuration {
    if ($VerifyOnly) { return }
    if ([string]::IsNullOrWhiteSpace($FunctionUrl)) {
        throw 'Bitte das konfigurierte Skript im Adminbereich herunterladen oder -FunctionUrl als HTTPS-Endpunkt übergeben.'
    }
    if (-not $script:FunctionUrl.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'FunctionUrl muss HTTPS verwenden.'
    }
    if ([string]::IsNullOrWhiteSpace($script:ExportId)) { $script:ExportId = Read-Host 'Export-ID aus dem Adminbereich' }
    if ($script:ExportId -notmatch '^[0-9a-fA-F-]{36}$') { throw 'Ungültige Export-ID.' }
    if (-not [string]::IsNullOrWhiteSpace($env:AUTOHAUS_STORAGE_EXPORT_SECRET)) {
        # Nur für kontrollierte Automatisierung; niemals in Dateien, Logs oder Kommandozeilen ausgeben.
        $script:ExportSecret = $env:AUTOHAUS_STORAGE_EXPORT_SECRET
    } else {
        $script:ExportSecret = Read-SecretText
    }
    if ($script:ExportSecret.Length -lt 32) { throw 'Ungültiges Exportsitzungs-Secret.' }
}

New-DirectoryIfMissing $script:Root
New-DirectoryIfMissing $script:ManifestDir
New-DirectoryIfMissing $script:PackageDir
try {
    Assert-Configuration
    if ($VerifyOnly) {
        if (-not (Test-Path -LiteralPath $script:FilesPath)) { throw 'Kein Manifest gefunden.' }
        Test-ManifestFiles @(Read-JsonLines $script:FilesPath)
    } else {
        New-OrUpdateManifest
        $files = @(Read-JsonLines $script:FilesPath)
        if ($TestOnly) {
            Start-TestExport $files
        } elseif ($Download) {
            Start-Download $files
        } else {
            Write-Step 'Nur Manifest und Datenbankabgleich erstellt. Kein Datei-Download gestartet.'
            Write-Step ("Dateiliste: {0}" -f (Join-Path $script:ManifestDir 'files.csv'))
        }
    }
} finally {
    $script:ExportSecret = $null
    $script:SignedUrls = $null
}
