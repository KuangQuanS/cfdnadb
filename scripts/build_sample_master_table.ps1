param(
    [string]$PublicCsv = (Join-Path $PSScriptRoot "..\cfdna_public_data.csv"),
    [string]$PrivateCsv = (Join-Path $PSScriptRoot "..\cfdna_private_data.csv"),
    [string]$OutputCsv = (Join-Path $PSScriptRoot "..\sample_master_table.csv")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:publicSampleIdColumn = ""
$script:publicSampleNumberColumn = "Sample Number"
$script:publicMarkerTypeColumn = ""
$script:publicClinicalColumn = ""
$script:publicPlatformColumn = ""

function Get-NormalizedSampleId {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ""
    }

    return (($Value.ToUpperInvariant()) -replace "[^A-Z0-9]+", "")
}

function Get-CsvHeaders {
    param([string]$Path)

    $headerLine = Get-Content -Path $Path -TotalCount 1 -Encoding UTF8
    $headers = [System.Collections.Generic.List[string]]::new()
    $extraIndex = 1

    foreach ($token in ($headerLine -split ",")) {
        $name = $token.Trim().Trim([char]0xFEFF)
        if ([string]::IsNullOrWhiteSpace($name)) {
            $name = "Extra_$extraIndex"
            $extraIndex++
        }
        $headers.Add($name)
    }

    return [string[]]$headers
}

function Initialize-PublicSchema {
    param([string[]]$Headers)

    $script:publicSampleIdColumn = @($Headers | Where-Object { $_ -like "Sample_ID:*" })[0]
    $script:publicMarkerTypeColumn = @($Headers | Where-Object { $_ -like "Marker_Type*" })[0]
    $script:publicClinicalColumn = @($Headers | Where-Object { $_ -like "Clinical_Significance*" })[0]
    $script:publicPlatformColumn = @($Headers | Where-Object { $_ -like "Sequencing_Platform:*" })[0]

    foreach ($requiredColumn in @(
        $script:publicSampleIdColumn,
        $script:publicSampleNumberColumn,
        $script:publicMarkerTypeColumn,
        $script:publicClinicalColumn,
        $script:publicPlatformColumn
    )) {
        if ([string]::IsNullOrWhiteSpace($requiredColumn)) {
            throw "Failed to resolve one or more public CSV columns."
        }
    }
}

function Join-UniqueValues {
    param(
        [object[]]$Values,
        [string]$Separator = "; "
    )

    $items = @(
        $Values |
            ForEach-Object { if ($null -ne $_) { "$_".Trim() } } |
            Where-Object { $_ -ne "" } |
            Sort-Object -Unique
    )

    return ($items -join $Separator)
}

function Get-UniqueCount {
    param([object[]]$Values)

    return @(
        $Values |
            ForEach-Object { if ($null -ne $_) { "$_".Trim() } } |
            Where-Object { $_ -ne "" } |
            Sort-Object -Unique
    ).Count
}

function Get-TopValueSummary {
    param(
        [object[]]$Rows,
        [scriptblock]$Selector,
        [int]$TopN = 8
    )

    $groups = @(
        foreach ($row in $Rows) {
            $value = & $Selector $row
            if ($null -eq $value) {
                continue
            }

            $text = "$value".Trim()
            if ($text -eq "") {
                continue
            }

            $text
        }
    ) |
        Group-Object |
        Sort-Object @{ Expression = "Count"; Descending = $true }, @{ Expression = "Name"; Descending = $false } |
        Select-Object -First $TopN

    return (($groups | ForEach-Object { "{0}({1})" -f $_.Name, $_.Count }) -join "; ")
}

function Get-PublicRows {
    param([string]$Path)

    $headers = Get-CsvHeaders -Path $Path
    Initialize-PublicSchema -Headers $headers
    $rows = Import-Csv -Path $Path -Header $headers -Encoding UTF8 | Select-Object -Skip 1

    return @(
        $rows | Where-Object {
            ($_.PMID -and $_.PMID.Trim() -ne "") -or
            ($_.$script:publicSampleIdColumn -and $_.$script:publicSampleIdColumn.Trim() -ne "") -or
            ($_.Gene -and $_.Gene.Trim() -ne "") -or
            ($_.Chromosome -and $_.Chromosome.Trim() -ne "") -or
            ($_.$script:publicPlatformColumn -and $_.$script:publicPlatformColumn.Trim() -ne "") -or
            ($_.Condition -and $_.Condition.Trim() -ne "")
        }
    )
}

function Get-PrivateRows {
    param([string]$Path)

    return @(Import-Csv -Path $Path -Encoding UTF8)
}

function New-PublicSampleSummary {
    param(
        [string]$GroupKey,
        [object[]]$Rows,
        [string]$RowType,
        [string]$Notes
    )

    $sampleId = if ($RowType -eq "sample") { $GroupKey } else { "" }

    [pscustomobject][ordered]@{
        row_type                 = $RowType
        source_dataset           = "public"
        sample_key               = "public::{0}" -f $GroupKey
        sample_id_raw            = $sampleId
        sample_id_normalized     = Get-NormalizedSampleId -Value $sampleId
        sample_alias             = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.$script:publicSampleNumberColumn })
        source_file              = "cfdna_public_data.csv"
        pmid_list                = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.PMID })
        gse_number_list          = Join-UniqueValues -Values ($Rows | ForEach-Object { $_."GSE Number" })
        cancer_type_list         = ""
        condition_list           = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.Condition })
        sequencing_platform_list = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.$script:publicPlatformColumn })
        marker_record_count      = $Rows.Count
        unique_gene_count        = Get-UniqueCount -Values ($Rows | ForEach-Object { $_.Gene })
        unique_locus_count       = Get-UniqueCount -Values ($Rows | ForEach-Object { $_.Chromosome })
        top_genes                = Get-TopValueSummary -Rows $Rows -Selector { param($row) $row.Gene } -TopN 10
        marker_type_list         = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.$script:publicMarkerTypeColumn })
        variant_class_list       = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.$script:publicClinicalColumn })
        functional_region_list   = ""
        notes                    = $Notes
    }
}

function New-PrivateSampleSummary {
    param(
        [string]$Barcode,
        [object[]]$Rows
    )

    $locusValues = foreach ($row in $Rows) {
        if ($row.Location -and $row.Location.Trim() -ne "") {
            $row.Location.Trim()
            continue
        }

        if ($row.Chromosome -and $row.Start_Position -and $row.End_Position) {
            "{0}:{1}-{2}" -f $row.Chromosome, $row.Start_Position, $row.End_Position
        }
    }

    [pscustomobject][ordered]@{
        row_type                 = "sample"
        source_dataset           = "private"
        sample_key               = "private::{0}" -f $Barcode
        sample_id_raw            = $Barcode
        sample_id_normalized     = Get-NormalizedSampleId -Value $Barcode
        sample_alias             = ""
        source_file              = "cfdna_private_data.csv"
        pmid_list                = ""
        gse_number_list          = ""
        cancer_type_list         = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.Cancer_Type })
        condition_list           = ""
        sequencing_platform_list = ""
        marker_record_count      = $Rows.Count
        unique_gene_count        = Get-UniqueCount -Values ($Rows | ForEach-Object {
            if ($_.Hugo_Symbol -and $_.Hugo_Symbol.Trim() -ne "") {
                $_.Hugo_Symbol
            }
            else {
                $_."Gene.refGene"
            }
        })
        unique_locus_count       = Get-UniqueCount -Values $locusValues
        top_genes                = Get-TopValueSummary -Rows $Rows -Selector {
            param($row)
            if ($row.Hugo_Symbol -and $row.Hugo_Symbol.Trim() -ne "") {
                $row.Hugo_Symbol
            }
            else {
                $row."Gene.refGene"
            }
        } -TopN 10
        marker_type_list         = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.Variant_Type })
        variant_class_list       = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.Variant_Classification })
        functional_region_list   = Join-UniqueValues -Values ($Rows | ForEach-Object { $_."Func.refGene" })
        notes                    = ""
    }
}

$publicRows = Get-PublicRows -Path $PublicCsv
$privateRows = Get-PrivateRows -Path $PrivateCsv

$publicExactSampleRows = @(
    $publicRows | Where-Object { $_.$script:publicSampleIdColumn -and $_.$script:publicSampleIdColumn.Trim() -ne "" }
)

$publicBucketRows = @(
    $publicRows | Where-Object { -not $_.$script:publicSampleIdColumn -or $_.$script:publicSampleIdColumn.Trim() -eq "" }
)

$outputRows = [System.Collections.Generic.List[object]]::new()

foreach ($group in ($publicExactSampleRows | Group-Object $script:publicSampleIdColumn | Sort-Object Name)) {
    $outputRows.Add((New-PublicSampleSummary -GroupKey $group.Name -Rows @($group.Group) -RowType "sample" -Notes "")) | Out-Null
}

foreach ($group in ($publicBucketRows | Group-Object {
    if ($_.PMID -and $_.PMID.Trim() -ne "") {
        "bucket::{0}" -f $_.PMID.Trim()
    }
    else {
        "bucket::unknown"
    }
} | Sort-Object Name)) {
    $note = "Meaningful public rows without a sample identifier were bucketed together."
    $outputRows.Add((New-PublicSampleSummary -GroupKey $group.Name -Rows @($group.Group) -RowType "publication_bucket" -Notes $note)) | Out-Null
}

foreach ($group in ($privateRows | Group-Object Tumor_Sample_Barcode | Sort-Object Name)) {
    $outputRows.Add((New-PrivateSampleSummary -Barcode $group.Name -Rows @($group.Group))) | Out-Null
}

$outputDirectory = Split-Path -Path $OutputCsv -Parent
if ($outputDirectory -and -not (Test-Path $outputDirectory)) {
    New-Item -Path $outputDirectory -ItemType Directory | Out-Null
}

$outputRows |
    Sort-Object source_dataset, sample_id_raw |
    Export-Csv -Path $OutputCsv -Encoding UTF8 -NoTypeInformation

Write-Output ("Output: {0}" -f $OutputCsv)
Write-Output ("Public sample rows: {0}" -f (@($outputRows | Where-Object { $_.source_dataset -eq "public" -and $_.row_type -eq "sample" }).Count))
Write-Output ("Public bucket rows: {0}" -f (@($outputRows | Where-Object { $_.source_dataset -eq "public" -and $_.row_type -eq "publication_bucket" }).Count))
Write-Output ("Private sample rows: {0}" -f (@($outputRows | Where-Object { $_.source_dataset -eq "private" }).Count))
Write-Output ("Total output rows: {0}" -f $outputRows.Count)
