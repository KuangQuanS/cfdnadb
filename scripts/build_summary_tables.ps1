param(
    [string]$PublicCsv = (Join-Path $PSScriptRoot "..\cfdna_public_data.csv"),
    [string]$PrivateCsv = (Join-Path $PSScriptRoot "..\cfdna_private_data.csv"),
    [string]$PublicOut = (Join-Path $PSScriptRoot "..\public_summary.csv"),
    [string]$PrivateOut = (Join-Path $PSScriptRoot "..\private_summary.csv"),
    [string]$OverallOut = (Join-Path $PSScriptRoot "..\overall_summary.csv")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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
        [int]$TopN = 10
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

function Get-PublicColumns {
    param([object[]]$Rows)

    if ($Rows.Count -eq 0) {
        throw "Public CSV has no rows."
    }

    $names = $Rows[0].PSObject.Properties.Name

    return @{
        SampleId    = @($names | Where-Object { $_ -like "Sample_ID:*" })[0]
        SampleNo    = "Sample Number"
        MarkerType  = @($names | Where-Object { $_ -like "Marker_Type*" })[0]
        Clinical    = @($names | Where-Object { $_ -like "Clinical_Significance*" })[0]
        Platform    = @($names | Where-Object { $_ -like "Sequencing_Platform:*" })[0]
    }
}

function Get-MeaningfulPublicRows {
    param(
        [object[]]$Rows,
        [hashtable]$Columns
    )

    return @(
        $Rows | Where-Object {
            ($_.PMID -and $_.PMID.Trim() -ne "") -or
            ($_.$($Columns.SampleId) -and $_.$($Columns.SampleId).Trim() -ne "") -or
            ($_.Gene -and $_.Gene.Trim() -ne "") -or
            ($_.Chromosome -and $_.Chromosome.Trim() -ne "") -or
            ($_.$($Columns.Platform) -and $_.$($Columns.Platform).Trim() -ne "") -or
            ($_.Condition -and $_.Condition.Trim() -ne "")
        }
    )
}

function New-PublicSummaryRow {
    param(
        [string]$GroupType,
        [string]$GroupId,
        [object[]]$Rows,
        [hashtable]$Columns
    )

    $sampleIds = @(
        $Rows |
            ForEach-Object { $_.$($Columns.SampleId) } |
            ForEach-Object { if ($null -ne $_) { "$_".Trim() } } |
            Where-Object { $_ -ne "" } |
            Sort-Object -Unique
    )

    [pscustomobject][ordered]@{
        source_dataset                        = "public"
        summary_level                         = "publication"
        group_type                            = $GroupType
        group_id                              = $GroupId
        sample_count                          = $sampleIds.Count
        sample_id_examples                    = (($sampleIds | Select-Object -First 10) -join "; ")
        pmid_list                             = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.PMID })
        gse_number_list                       = Join-UniqueValues -Values ($Rows | ForEach-Object { $_."GSE Number" })
        cancer_type_list                      = ""
        condition_list                        = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.Condition })
        sequencing_platform_list              = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.$($Columns.Platform) })
        marker_record_count                   = $Rows.Count
        variant_site_count                    = Get-UniqueCount -Values ($Rows | ForEach-Object { $_.Chromosome })
        gene_count                            = Get-UniqueCount -Values ($Rows | ForEach-Object { $_.Gene })
        top_genes                             = Get-TopValueSummary -Rows $Rows -Selector { param($row) $row.Gene }
        marker_or_variant_type_list           = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.$($Columns.MarkerType) })
        classification_or_significance_list   = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.$($Columns.Clinical) })
        functional_region_list                = ""
        notes                                 = if ($GroupType -eq "PMID") { "Grouped by PMID because GSE Number is empty." } else { "" }
    }
}

function New-PrivateSummaryRow {
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
        source_dataset                        = "private"
        summary_level                         = "sample"
        group_type                            = "Tumor_Sample_Barcode"
        group_id                              = $Barcode
        sample_count                          = 1
        sample_id_examples                    = $Barcode
        pmid_list                             = ""
        gse_number_list                       = ""
        cancer_type_list                      = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.Cancer_Type })
        condition_list                        = ""
        sequencing_platform_list              = ""
        marker_record_count                   = $Rows.Count
        variant_site_count                    = Get-UniqueCount -Values $locusValues
        gene_count                            = Get-UniqueCount -Values ($Rows | ForEach-Object {
            if ($_.Hugo_Symbol -and $_.Hugo_Symbol.Trim() -ne "") {
                $_.Hugo_Symbol
            }
            else {
                $_."Gene.refGene"
            }
        })
        top_genes                             = Get-TopValueSummary -Rows $Rows -Selector {
            param($row)
            if ($row.Hugo_Symbol -and $row.Hugo_Symbol.Trim() -ne "") {
                $row.Hugo_Symbol
            }
            else {
                $row."Gene.refGene"
            }
        }
        marker_or_variant_type_list           = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.Variant_Type })
        classification_or_significance_list   = Join-UniqueValues -Values ($Rows | ForEach-Object { $_.Variant_Classification })
        functional_region_list                = Join-UniqueValues -Values ($Rows | ForEach-Object { $_."Func.refGene" })
        notes                                 = ""
    }
}

$publicRowsRaw = @(Import-Csv -Path $PublicCsv -Encoding UTF8)
$privateRows = @(Import-Csv -Path $PrivateCsv -Encoding UTF8)
$publicColumns = Get-PublicColumns -Rows $publicRowsRaw
$publicRows = Get-MeaningfulPublicRows -Rows $publicRowsRaw -Columns $publicColumns

$publicSummary = @(
    foreach ($group in ($publicRows | Group-Object {
        $gse = if ($null -ne $_."GSE Number") { $_."GSE Number".Trim() } else { "" }
        $pmid = if ($null -ne $_.PMID) { $_.PMID.Trim() } else { "" }

        if ($gse -ne "") {
            "GSE`t$gse"
        }
        elseif ($pmid -ne "") {
            "PMID`t$pmid"
        }
        else {
            "UNASSIGNED`tNO_ID"
        }
    } | Sort-Object Name)) {
        $parts = $group.Name -split "`t", 2
        New-PublicSummaryRow -GroupType $parts[0] -GroupId $parts[1] -Rows @($group.Group) -Columns $publicColumns
    }
)

$privateSummary = @(
    foreach ($group in ($privateRows | Group-Object Tumor_Sample_Barcode | Sort-Object Name)) {
        New-PrivateSummaryRow -Barcode $group.Name -Rows @($group.Group)
    }
)

$overallSummary = @($publicSummary + $privateSummary) | Sort-Object source_dataset, group_id

$publicSummary | Export-Csv -Path $PublicOut -Encoding UTF8 -NoTypeInformation
$privateSummary | Export-Csv -Path $PrivateOut -Encoding UTF8 -NoTypeInformation
$overallSummary | Export-Csv -Path $OverallOut -Encoding UTF8 -NoTypeInformation

Write-Output ("Public rows: {0}" -f $publicSummary.Count)
Write-Output ("Private rows: {0}" -f $privateSummary.Count)
Write-Output ("Overall rows: {0}" -f $overallSummary.Count)
Write-Output ("Public output: {0}" -f $PublicOut)
Write-Output ("Private output: {0}" -f $PrivateOut)
Write-Output ("Overall output: {0}" -f $OverallOut)
