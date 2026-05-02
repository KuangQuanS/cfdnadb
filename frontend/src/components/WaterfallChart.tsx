import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import type { OncoplottData } from "../types/api";

const EMPTY_CELL_COLOR = "#eef2f7";

const MUTATION_TYPES = [
  { cls: "Missense_Mutation", color: "#1F78B4", label: "Missense mutation" },
  { cls: "Nonsense_Mutation", color: "#E31A1C", label: "Nonsense mutation" },
  { cls: "Frame_Shift_Del", color: "#6A3D9A", label: "Frame shift del" },
  { cls: "Frame_Shift_Ins", color: "#CAB2D6", label: "Frame shift ins" },
  { cls: "Splice_Site", color: "#4D4D4D", label: "Splice site" },
  { cls: "In_Frame_Del", color: "#A6CEE3", label: "In-frame del" },
  { cls: "In_Frame_Ins", color: "#66C2A5", label: "In-frame ins" },
  { cls: "Nonstop_Mutation", color: "#B15928", label: "Nonstop mutation" },
  { cls: "Translation_Start_Site", color: "#B15928", label: "Translation start site" },
  { cls: "Silent", color: "#FB9A99", label: "Silent" },
  { cls: "__other__", color: "#000000", label: "Multi-hit / other" },
] as const;

const CLASS_TO_INDEX: Record<string, number> = {};
const CLASS_TO_META = new Map<string, (typeof MUTATION_TYPES)[number]>();
const SORT_SEVERITY: Record<string, number> = {
  Nonsense_Mutation: 1,
  Frame_Shift_Del: 2,
  Frame_Shift_Ins: 3,
  Splice_Site: 4,
  Nonstop_Mutation: 4,
  Translation_Start_Site: 4,
  In_Frame_Del: 5,
  In_Frame_Ins: 6,
  Missense_Mutation: 7,
  Silent: 8,
  __other__: 9,
};

MUTATION_TYPES.forEach((item, index) => {
  CLASS_TO_INDEX[item.cls] = index + 1;
  CLASS_TO_META.set(item.cls, item);
});

function normalizeVariantClass(variantClass: string) {
  return CLASS_TO_META.has(variantClass) ? variantClass : "__other__";
}

interface WaterfallChartProps {
  data: OncoplottData;
  title?: string;
  cellHeight?: number;
}

export function WaterfallChart({ data, title, cellHeight = 18 }: WaterfallChartProps) {
  const { genes, samples, cells, geneCounts, sampleCounts } = data;
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const totalSamples = samples.length;
  const totalGenes = genes.length;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const displayGenes = useMemo(() => [...genes].reverse(), [genes]);
  const displaySamples = useMemo(() => {
    const sampleGeneClass = new Map<string, Map<string, string>>();

    for (const cell of cells) {
      const normalizedClass = normalizeVariantClass(cell.variantClass);
      let geneMap = sampleGeneClass.get(cell.sample);
      if (!geneMap) {
        geneMap = new Map<string, string>();
        sampleGeneClass.set(cell.sample, geneMap);
      }

      const existing = geneMap.get(cell.gene);
      if (!existing || (SORT_SEVERITY[normalizedClass] ?? 9) < (SORT_SEVERITY[existing] ?? 9)) {
        geneMap.set(cell.gene, normalizedClass);
      }
    }

    return [...samples].sort((left, right) => {
      const leftMap = sampleGeneClass.get(left) ?? new Map<string, string>();
      const rightMap = sampleGeneClass.get(right) ?? new Map<string, string>();

      for (const gene of genes) {
        const leftRank = SORT_SEVERITY[leftMap.get(gene) ?? "__other__"] ?? 9;
        const rightRank = SORT_SEVERITY[rightMap.get(gene) ?? "__other__"] ?? 9;
        const leftMutated = leftMap.has(gene);
        const rightMutated = rightMap.has(gene);

        if (leftMutated !== rightMutated) return leftMutated ? -1 : 1;
        if (leftMutated && rightMutated && leftRank !== rightRank) return leftRank - rightRank;
      }

      const countDiff = (sampleCounts[right] ?? 0) - (sampleCounts[left] ?? 0);
      if (countDiff !== 0) return countDiff;
      return left.localeCompare(right);
    });
  }, [cells, genes, sampleCounts, samples]);

  const handleChartClick = useCallback(
    (params: { componentType?: string; value?: unknown }) => {
      if (params.componentType !== "yAxis") return;
      const gene = String(params.value ?? "").trim();
      if (gene) navigate(`/gene-search?gene=${encodeURIComponent(gene)}`);
    },
    [navigate]
  );

  const { heatmapData, topBarData, geneTypeCounts, visibleMutationTypes, visibleSeriesTypes } = useMemo(() => {
    const sampleIndex = new Map(displaySamples.map((sample, index) => [sample, index]));
    const geneIndex = new Map(displayGenes.map((gene, index) => [gene, index]));
    const cellMap = new Map<string, string>();
    const typeCounts: Record<string, Record<string, number>> = {};
    const visible = new Set<string>();

    for (const cell of cells) {
      const x = sampleIndex.get(cell.sample);
      const y = geneIndex.get(cell.gene);
      if (x === undefined || y === undefined) continue;

      const normalizedClass = normalizeVariantClass(cell.variantClass);
      cellMap.set(`${x}::${y}`, normalizedClass);
      visible.add(normalizedClass);

      if (!typeCounts[cell.gene]) typeCounts[cell.gene] = {};
      typeCounts[cell.gene][normalizedClass] = (typeCounts[cell.gene][normalizedClass] ?? 0) + 1;
    }

    const matrix: [number, number, number][] = [];
    for (let y = 0; y < displayGenes.length; y += 1) {
      for (let x = 0; x < displaySamples.length; x += 1) {
        const variantClass = cellMap.get(`${x}::${y}`);
        matrix.push([x, y, variantClass ? CLASS_TO_INDEX[variantClass] ?? CLASS_TO_INDEX.__other__ : 0]);
      }
    }

    return {
      heatmapData: matrix,
      topBarData: displaySamples.map((sample) => sampleCounts[sample] ?? 0),
      geneTypeCounts: typeCounts,
      visibleMutationTypes: [
        { cls: "__empty__", color: EMPTY_CELL_COLOR, label: "No alteration" },
        ...MUTATION_TYPES.filter((item) => visible.has(item.cls)),
      ],
      visibleSeriesTypes: MUTATION_TYPES.filter((item) => visible.has(item.cls)),
    };
  }, [cells, displayGenes, displaySamples, sampleCounts]);

  const availableWidth = Math.max(containerWidth || 0, 720);
  const compactLayout = availableWidth < 1100;
  const leftLabelWidth = compactLayout ? 124 : 170;
  const rightPanelWidth = compactLayout ? 56 : 72;
  const rightGap = compactLayout ? 8 : 10;
  const heatmapWidth = Math.max(
    availableWidth - leftLabelWidth - rightPanelWidth - rightGap - 12,
    260
  );
  const cellWidth = Math.max(heatmapWidth / Math.max(displaySamples.length, 1), compactLayout ? 1.5 : 2);
  const showSampleLabels = totalSamples <= 40;
  const hasZoom = totalSamples > 50;
  const topBarHeight = 72;
  const titleOffset = title ? 34 : 10;
  const heatmapTop = titleOffset + topBarHeight + 10;
  const heatmapHeight = Math.max(totalGenes * cellHeight, 220);
  const chartHeight = heatmapTop + heatmapHeight + (showSampleLabels ? 78 : 24) + (hasZoom ? 42 : 0);

  const rightStackedSeries = useMemo(
    () =>
      visibleSeriesTypes.map((item) => ({
        type: "bar" as const,
        name: item.label,
        stack: "mutation-type",
        xAxisIndex: 2,
        yAxisIndex: 2,
        barWidth: Math.max(cellHeight - 6, 7),
        itemStyle: { color: item.color, borderRadius: 0 },
        emphasis: { disabled: true },
        data: displayGenes.map((gene) => geneTypeCounts[gene]?.[item.cls] ?? 0),
      })),
    [cellHeight, displayGenes, geneTypeCounts, visibleSeriesTypes]
  );

  const option = useMemo(
    () => ({
      animation: false,
      backgroundColor: "#ffffff",
      title: title
        ? {
            text: title,
            left: "center",
            top: 6,
            textStyle: {
              color: "#1f2a44",
              fontSize: 15,
              fontWeight: 700,
            },
          }
        : undefined,
      tooltip: {
        confine: true,
        backgroundColor: "rgba(23, 32, 50, 0.96)",
        borderWidth: 0,
        textStyle: {
          color: "#f5f7fb",
          fontSize: 12,
        },
        formatter: (params: any) => {
          if (params.seriesType === "heatmap") {
            const [x, y, value] = params.data as [number, number, number];
            const sample = displaySamples[x] ?? "";
            const gene = displayGenes[y] ?? "";
            const alteredSamples = geneCounts[gene] ?? 0;
            const frequency = totalSamples > 0 ? ((alteredSamples / totalSamples) * 100).toFixed(1) : "0.0";

            if (value === 0) {
              return `<b>${gene}</b><br/>${sample}<br/><span style="color:#c6d0e0">No alteration</span>`;
            }

            const mutationType = MUTATION_TYPES[value - 1];
            return [
              `<b>${gene}</b>`,
              `<span style="color:#c6d0e0">${alteredSamples}/${totalSamples} samples (${frequency}%)</span>`,
              `${sample}`,
              `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${mutationType?.color ?? "#000"};margin-right:6px;"></span>${mutationType?.label ?? "Other"}`,
            ].join("<br/>");
          }

          if (params.seriesType === "bar" && params.seriesIndex === 0) {
            return `${displaySamples[params.dataIndex] ?? ""}<br/>Altered genes: <b>${params.value}</b>`;
          }

          if (params.seriesType === "bar") {
            const gene = displayGenes[params.dataIndex] ?? "";
            const alteredSamples = geneCounts[gene] ?? 0;
            const frequency = totalSamples > 0 ? ((alteredSamples / totalSamples) * 100).toFixed(1) : "0.0";
            return [
              `<b>${gene}</b>`,
              `<span style="color:#c6d0e0">${alteredSamples}/${totalSamples} samples (${frequency}%)</span>`,
              `${params.seriesName}: <b>${params.value}</b>`,
            ].join("<br/>");
          }

          return "";
        },
      },
      grid: [
        {
          left: leftLabelWidth,
          top: titleOffset,
          width: heatmapWidth,
          height: topBarHeight,
        },
        {
          left: leftLabelWidth,
          top: heatmapTop,
          width: heatmapWidth,
          height: heatmapHeight,
        },
        {
          left: leftLabelWidth + heatmapWidth + rightGap,
          top: heatmapTop,
          width: rightPanelWidth,
          height: heatmapHeight,
        },
      ],
      xAxis: [
        {
          type: "category",
          gridIndex: 0,
          data: displaySamples,
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { show: false },
          splitLine: { show: false },
        },
        {
          type: "category",
          gridIndex: 1,
          data: displaySamples,
          axisLabel: {
            show: showSampleLabels,
            interval: 0,
            rotate: 60,
            margin: 10,
            color: "#6c7a92",
            fontSize: 9,
          },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: "#d7deea" } },
          splitLine: { show: false },
        },
        {
          type: "value",
          gridIndex: 2,
          min: 0,
          axisLabel: {
            show: false,
          },
          axisTick: { show: false },
          axisLine: { show: false },
          splitLine: {
            show: false,
            lineStyle: { color: "#eef2f7" },
          },
        },
      ],
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          min: 0,
          axisLabel: {
            color: "#6c7a92",
            fontSize: 10,
          },
          axisTick: { show: false },
          axisLine: { show: false },
          splitLine: {
            show: true,
            lineStyle: { color: "#eef2f7" },
          },
        },
        {
          type: "category",
          gridIndex: 1,
          data: displayGenes,
          triggerEvent: true,
          axisLabel: {
            margin: 14,
            fontSize: 11,
            formatter: (gene: string) => {
              const alteredSamples = geneCounts[gene] ?? 0;
              const frequency = totalSamples > 0 ? ((alteredSamples / totalSamples) * 100).toFixed(1) : "0.0";
              return `{gene|${gene}} {pct|${frequency}%}`;
            },
            rich: {
              gene: {
                color: "#1f4b84",
                fontWeight: 700,
                width: 78,
                align: "right",
              },
              pct: {
                color: "#7a879d",
                fontSize: 10,
                width: 42,
                align: "left",
              },
            },
          },
          axisTick: { show: false },
          axisLine: { show: false },
          splitLine: { show: false },
        },
        {
          type: "category",
          gridIndex: 2,
          data: displayGenes,
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { show: false },
          splitLine: { show: false },
        },
      ],
      visualMap: {
        show: false,
        min: 0,
        max: MUTATION_TYPES.length,
        seriesIndex: 1,
        pieces: [
          { value: 0, color: EMPTY_CELL_COLOR },
          ...MUTATION_TYPES.map((item, index) => ({
            value: index + 1,
            color: item.color,
          })),
        ],
      },
      dataZoom: hasZoom
        ? [
            {
              type: "slider",
              xAxisIndex: [0, 1],
              filterMode: "none",
              realtime: true,
              brushSelect: false,
              height: 16,
              bottom: 10,
              borderColor: "#d7deea",
              backgroundColor: "#f3f6fb",
              dataBackground: {
                lineStyle: { color: "#b7c7e2" },
                areaStyle: { color: "#e7eef9" },
              },
              fillerColor: "rgba(79, 111, 174, 0.18)",
              handleStyle: {
                color: "#4f6fae",
                borderColor: "#4f6fae",
              },
              moveHandleStyle: {
                color: "#8aa3cf",
              },
              textStyle: {
                color: "#6c7a92",
              },
              start: 0,
              end: 100,
            },
            {
              type: "inside",
              xAxisIndex: [0, 1],
              filterMode: "none",
              zoomOnMouseWheel: "shift",
              moveOnMouseMove: true,
              moveOnMouseWheel: true,
            },
          ]
        : undefined,
      series: [
        {
          type: "bar",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: topBarData,
          barWidth: Math.max(Math.floor(cellWidth - 1), 1),
          itemStyle: {
            color: "#4f6fae",
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: { disabled: true },
        },
        {
          type: "heatmap",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: heatmapData,
          progressive: 0,
          itemStyle: {
            borderWidth: 1,
            borderColor: "#ffffff",
          },
          emphasis: {
            itemStyle: {
              borderColor: "#1f2a44",
              borderWidth: 1.2,
            },
          },
        },
        ...rightStackedSeries,
      ],
    }),
    [
      cellWidth,
      displayGenes,
      geneCounts,
      heatmapData,
      heatmapHeight,
      heatmapTop,
      heatmapWidth,
      leftLabelWidth,
      rightGap,
      rightPanelWidth,
      rightStackedSeries,
      displaySamples,
      hasZoom,
      showSampleLabels,
      title,
      titleOffset,
      topBarData,
      topBarHeight,
      totalSamples,
    ]
  );

  return (
    <div className="waterfall-chart-wrap" ref={wrapperRef}>
      <div className="waterfall-chart-shell">
        <p className="waterfall-gene-hint">Click gene labels to open Gene Search</p>
        <div className="waterfall-chart-legend waterfall-chart-legend--overlay" aria-label="Mutation legend">
          {visibleMutationTypes.map((item) => (
            <span key={item.cls} className="waterfall-chart-legend-item">
              <span
                className="waterfall-chart-legend-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </span>
          ))}
        </div>
        <ReactECharts
          option={option}
          style={{ width: "100%", height: chartHeight }}
          notMerge
          onEvents={{ click: handleChartClick }}
        />
      </div>
    </div>
  );
}
