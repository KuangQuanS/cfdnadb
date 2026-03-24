# cfDNA 数据库设计与服务器目录深度文档

本文档以服务器真实路径为唯一主线，记录当前 cfDNA 数据存储现状，并给出可直接执行的实现起步方案。

## 1. 服务器路径基准

统一数据根路径：`/400T/cfdandb/`

顶层目录：

- `Breast/`
- `Colonrector/`
- `Liver/`
- `Lung/`
- `Pdac/`

说明：正文只描述服务器路径。本地 mock 仅保留在附录作为可选方案。

## 2. 分癌种目录深度盘点

### 2.1 Breast（当前最完整）

根目录文件（4）：

- `Breast_all_sample_multianno.txt`
- `Breast_merged.avinput`
- `Breast_merged_filtered.vcf.gz`
- `Breast_merged_filtered.vcf.gz.csi`

一级子目录文件数：

- `avinput/`: 48
- `filtered_vcf/`: 96
- `multianno/`: 48
- `somatic_vcf/`: 96
- `Plot/`: 2
- `TCGA/`: 3
- `GEO/`: 0（仅表示 GEO 根目录无直接文件，实际数据在二级目录）

`GEO/` 二级目录文件数：

- `GEO/Plot/`: 0
- `GEO/avinput/`: 65
- `GEO/multianno/`: 65
- `GEO/vcf/`: 65

代表文件（真实存在）：

- `Breast/avinput/RTCG0P0001-1-TWN1.avinput`
- `Breast/filtered_vcf/RTCG0P0003-1-TWN1.filtered.vcf.gz`
- `Breast/multianno/RTCG0P0004-1-TWN1.hg38_multianno.txt`
- `Breast/Plot/Breast_oncplot.pdf`
- `Breast/TCGA/TCGA-BRCA.somaticmutation_wxs.tsv`

### 2.2 Colonrector（流程已打通）

根目录文件（2）：

- `Colonrector_all_sample_multianno.txt`
- `Colonrector_merged.avinput`

一级子目录文件数：

- `avinput/`: 50
- `filtered_vcf/`: 100
- `multianno/`: 50
- `somatic_vcf/`: 100
- `Plot/`: 2

代表文件（真实存在）：

- `Colonrector/avinput/CTBZ0P0051-1-TWN1.avinput`
- `Colonrector/filtered_vcf/CTBZ0P0051-1-TWN1.filtered.vcf.gz`
- `Colonrector/multianno/CTBZ0P0051-1-TWN1.hg38_multianno.txt`
- `Colonrector/somatic_vcf/CTBZ0P0051-1-TWN1_somatic.vcf.gz`
- `Colonrector/Plot/CRC_oncplot.pdf`

### 2.3 Lung（样本已大量导入，注释待执行）

根目录普通文件：0

一级子目录文件数：

- `avinput/`: 536
- `filtered_vcf/`: 1072
- `multianno/`: 0
- `somatic_vcf/`: 0
- `Plot/`: 0

代表文件（真实存在）：

- `Lung/avinput/FTBZ0P0051-1-TON1.avinput`
- `Lung/avinput/Lib-001.avinput`
- `Lung/avinput/TGYX000081_FKDL210263035-1a.avinput`
- `Lung/filtered_vcf/FTBZ0P0051-1-TON1.filtered.vcf.gz`
- `Lung/filtered_vcf/Lib-001.filtered.vcf.gz.tbi`

### 2.4 Liver（目录已建，数据待导入）

根目录普通文件：0

一级子目录文件数：

- `avinput/`: 0
- `filtered_vcf/`: 0
- `multianno/`: 0
- `somatic_vcf/`: 0
- `Plot/`: 0

### 2.5 Pdac（目录已建，数据待导入）

根目录普通文件：0

一级子目录文件数：

- `avinput/`: 0
- `filtered_vcf/`: 0
- `multianno/`: 0
- `somatic_vcf/`: 0
- `Plot/`: 0

## 3. 文件命名规则

- `avinput`: `{SampleID}.avinput`
- `filtered_vcf`: `{SampleID}.filtered.vcf.gz` + 对应索引 `.tbi`
- `multianno`: `{SampleID}.hg38_multianno.txt`
- `somatic_vcf`: `{SampleID}_somatic.vcf.gz` + 对应索引 `.tbi`
- `Plot`: 通常为 `*_oncplot.pdf`、`*_summary.pdf`
- 癌种级汇总：`{Cancer}_all_sample_multianno.txt`
- 癌种级合并输入：`{Cancer}_merged.avinput`

## 4. 构建完成度矩阵

| 癌种 | 原始导入 | 过滤结果 | 注释结果 | 体细胞结果 | 图表 | 外部数据 |
| --- | --- | --- | --- | --- | --- | --- |
| Breast | 已完成 | 已完成 | 已完成 | 已完成 | 已完成 | 已完成（GEO/TCGA） |
| Colonrector | 已完成 | 已完成 | 已完成 | 已完成 | 已完成 | 未接入 |
| Lung | 已完成 | 已完成 | 未开始 | 未开始 | 未开始 | 未接入 |
| Liver | 未开始 | 未开始 | 未开始 | 未开始 | 未开始 | 未接入 |
| Pdac | 未开始 | 未开始 | 未开始 | 未开始 | 未开始 | 未接入 |

## 5. 可视化实施建议（按当前数据可直接落地）

优先级 1（马上可做）：

- Oncoplot（Breast、Colonrector 现有 Plot 可先接入展示）
- 基因突变频次 TopN 柱状图（基于 `*_all_sample_multianno.txt`）
- 样本维度变异数量分布图（按 `Tumor_Sample_Barcode` 聚合）

优先级 2（需要注释层更完整）：

- Lollipop（按 `AAChange.refGene` 统计）
- VAF 分布图（需确认是否已存在 AF/VAF 字段）
- Ti/Tv 比例图（SNV 类型分解）

优先级 3（高级浏览）：

- IGV 在线浏览（需要 `.vcf.gz` 与索引完整可访问）

## 6. Start Implementation：第一阶段任务

### 6.1 后端（CSV + DuckDB，不上 SQL 服务）

实现三个最小接口：

- `GET /api/v1/summary/cancers`
  - 返回各癌种样本规模、文件阶段完成情况。
- `GET /api/v1/variants/top-genes?cancer=Breast&limit=20`
  - 从 `{Cancer}_all_sample_multianno.txt` 统计高频基因。
- `GET /api/v1/variants/by-gene?cancer=Breast&gene=TP53&page=1&page_size=50`
  - 返回指定基因的变异明细。

后端路径约定：

- 固定根目录：`/400T/cfdandb`
- 所有数据读取都由 `{BASE_DIR}/{Cancer}/...` 拼接，不写死单文件路径。

### 6.2 前端（先做能看的最小系统）

页面 1：数据总览

- 各癌种完成度矩阵
- 各癌种样本文件数统计卡片

页面 2：基因检索

- 输入癌种 + 基因名
- 表格展示变异明细（Chr/Start/End/Ref/Alt/Func/Gene/Sample）

页面 3：图表

- TopN 基因柱状图
- 现有 PDF 图表预览（`Plot/` 与 `TCGA/`）

## 7. 附录（可选）：本地 mock

仅在脱离服务器开发时使用，不作为主路径方案。若使用本地 mock，应复制最小子集并保持与服务器目录同名。