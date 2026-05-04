param(
  [string]$InputPath = 'export_carworkshop.xlsx',
  [string]$JsonOutputPath = 'public/data/workshops.json',
  [string]$LegacyJsOutputPath = 'data/workshops.js',
  [string]$CityCachePath = 'data/city-cache.json'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ColIndex([string]$CellReference) {
  $letters = ($CellReference -replace '\d', '')
  $sum = 0
  foreach ($char in $letters.ToCharArray()) { $sum = ($sum * 26) + ([int][char]$char - [int][char]'A' + 1) }
  return $sum
}

function Convert-ToPlainText($Value) {
  if ($null -eq $Value) { return $null }
  if ($Value -is [System.Array]) { return (($Value | ForEach-Object { Convert-ToPlainText $_ }) -join '') }
  if ($Value -is [System.Xml.XmlNode]) { return $Value.InnerText }
  return [string]$Value
}

function Get-CellValue($Cell, $SharedStrings) {
  if ($null -eq $Cell) { return $null }
  if ($Cell.t -eq 's') { return Convert-ToPlainText $SharedStrings[[int]$Cell.v] }
  if ($Cell.t -eq 'inlineStr') { return Convert-ToPlainText $Cell.is }
  if ($Cell.v) { return Convert-ToPlainText $Cell.v }
  return $null
}

function Convert-ToBool($Value) {
  return [bool]($Value -eq '1' -or $Value -eq 'true' -or $Value -eq 'TRUE')
}

function Get-LookupKey($AddressId, $Lat, $Lng) {
  if ($AddressId) { return "address:$AddressId" }
  if (-not ([double]::IsNaN($Lat) -or [double]::IsNaN($Lng))) {
    return ('coord:{0},{1}' -f $Lat.ToString('F5', [System.Globalization.CultureInfo]::InvariantCulture), $Lng.ToString('F5', [System.Globalization.CultureInfo]::InvariantCulture))
  }
  return $null
}

if (-not (Test-Path $InputPath)) { throw "Arquivo não encontrado: $InputPath" }

New-Item -ItemType Directory -Force -Path (Split-Path $JsonOutputPath -Parent) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $LegacyJsOutputPath -Parent) | Out-Null

$cityCache = @{}
if (Test-Path $CityCachePath) {
  $cacheEntries = Get-Content -Encoding UTF8 -Raw $CityCachePath | ConvertFrom-Json
  foreach ($entry in $cacheEntries) {
    if ($entry.lookupKey) { $cityCache[[string]$entry.lookupKey] = $entry }
  }
}

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $InputPath))

try {
  $sharedReader = New-Object System.IO.StreamReader($zip.GetEntry('xl/sharedStrings.xml').Open())
  [xml]$sharedXml = $sharedReader.ReadToEnd()
  $sharedReader.Dispose()

  $sharedStrings = New-Object System.Collections.Generic.List[string]
  foreach ($item in $sharedXml.sst.si) {
    if ($item.t) { [void]$sharedStrings.Add((Convert-ToPlainText $item.t)) }
    elseif ($item.r) { [void]$sharedStrings.Add((Convert-ToPlainText $item.r)) }
    else { [void]$sharedStrings.Add('') }
  }

  $sheetReader = New-Object System.IO.StreamReader($zip.GetEntry('xl/worksheets/sheet1.xml').Open())
  [xml]$sheetXml = $sheetReader.ReadToEnd()
  $sheetReader.Dispose()

  $rows = $sheetXml.worksheet.sheetData.row
  $headers = @{}
  foreach ($cell in $rows[0].c) { $headers[(Get-ColIndex $cell.r)] = Get-CellValue $cell $sharedStrings }

  $records = New-Object System.Collections.Generic.List[object]

  foreach ($row in ($rows | Select-Object -Skip 1)) {
    $raw = @{}
    foreach ($cell in $row.c) {
      $index = Get-ColIndex $cell.r
      $header = $headers[$index]
      if ($header) { $raw[$header] = Get-CellValue $cell $sharedStrings }
    }

    $lat = if ($raw['latitude']) { [double]::Parse($raw['latitude'], [System.Globalization.CultureInfo]::InvariantCulture) } else { [double]::NaN }
    $lng = if ($raw['longitude']) { [double]::Parse($raw['longitude'], [System.Globalization.CultureInfo]::InvariantCulture) } else { [double]::NaN }
    $hasValidCoordinates = -not ([double]::IsNaN($lat) -or [double]::IsNaN($lng))
    $isInBrazil = $hasValidCoordinates -and $lat -ge -34.0 -and $lat -le 6.0 -and $lng -ge -74.5 -and $lng -le -28.0
    $displayName = if ($raw['trading_name']) { $raw['trading_name'] } else { $raw['corporate_name'] }
    $addressId = Convert-ToPlainText $raw['address_id']
    $lookupKey = Get-LookupKey $addressId $lat $lng
    $cityCacheEntry = if ($lookupKey -and $cityCache.ContainsKey($lookupKey)) { $cityCache[$lookupKey] } else { $null }

    $record = [PSCustomObject]@{
      id = [int]$raw['id']; sapId = Convert-ToPlainText $raw['sap_id']; corporateName = Convert-ToPlainText $raw['corporate_name']; tradingName = Convert-ToPlainText $raw['trading_name']; displayName = Convert-ToPlainText $displayName; addressId = $addressId;
      taxIdentifier = Convert-ToPlainText $raw['tax_identifier']; phone = Convert-ToPlainText $raw['phone']; email = Convert-ToPlainText $raw['email']; ownerName = Convert-ToPlainText $raw['owner_name']; ownerMobilePhone = Convert-ToPlainText $raw['owner_mobile_phone']; ownerEmail = Convert-ToPlainText $raw['owner_email'];
      concept = Convert-ToPlainText $raw['concept']; networkId = Convert-ToPlainText $raw['network_id']; categoryId = Convert-ToPlainText $raw['category_id']; regionServiceId = Convert-ToPlainText $raw['region_service_id']; regionPartId = Convert-ToPlainText $raw['region_part_id']; checkoutType = if ($raw['checkout_type']) { Convert-ToPlainText $raw['checkout_type'] } else { 'NO' };
      isActive = Convert-ToBool $raw['is_active']; isBlocked = Convert-ToBool $raw['is_blocked']; isOffline = Convert-ToBool $raw['is_offline']; isFee = Convert-ToBool $raw['is_fee']; isMargin = Convert-ToBool $raw['is_margin']; isWhiteLabel = Convert-ToBool $raw['is_white_label']; isDahruj = Convert-ToBool $raw['is_dahruj']; isNoIntermediation = Convert-ToBool $raw['is_no_intermediation'];
      isChecklistRequired = Convert-ToBool $raw['is_checklist_required']; checklistFilledByApp = Convert-ToBool $raw['checklist_filled_by_app']; isPrimaryOrigin = Convert-ToBool $raw['is_primary_origin'];
      lat = $lat; lng = $lng; hasValidCoordinates = $hasValidCoordinates; isInBrazil = $isInBrazil; lookupKey = $lookupKey;
      cityName = if ($cityCacheEntry) { Convert-ToPlainText $cityCacheEntry.cityName } else { '' };
      cityStateCode = if ($cityCacheEntry) { Convert-ToPlainText $cityCacheEntry.cityStateCode } else { '' };
      cityKey = if ($cityCacheEntry) { Convert-ToPlainText $cityCacheEntry.cityKey } else { '' };
      citySource = if ($cityCacheEntry) { Convert-ToPlainText $cityCacheEntry.source } else { '' };
      googleMapsId = Convert-ToPlainText $raw['google_maps_id']; purchaseOrder = Convert-ToPlainText $raw['purchase_order']; stateRegistration = Convert-ToPlainText $raw['state_registration']; franchiseId = Convert-ToPlainText $raw['franchise_id']
    }

    [void]$records.Add($record)
  }

  $json = $records | ConvertTo-Json -Depth 4 -Compress
  Set-Content -Encoding UTF8 -Path $JsonOutputPath -Value $json
  Set-Content -Encoding UTF8 -Path $LegacyJsOutputPath -Value ("window.WORKSHOPS = $json;")

  $total = $records.Count
  $insideBrazil = ($records | Where-Object { $_.isInBrazil }).Count
  $outsideBrazil = $total - $insideBrazil
  $withCity = ($records | Where-Object { $_.cityName }).Count

  Write-Output "EXPORT_OK total=$total inside_brazil=$insideBrazil outside_brazil=$outsideBrazil with_city=$withCity json=$JsonOutputPath legacy=$LegacyJsOutputPath"
}
finally {
  $zip.Dispose()
}
