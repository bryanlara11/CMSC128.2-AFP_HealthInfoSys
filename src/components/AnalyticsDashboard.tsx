import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../data/auth';
import { EMPTY_FILTERS, loadAnalytics, exportAnalytics, trendSeries, type AnalyticsFilters } from '../data/analytics';
import { downloadSummary } from '../data/export';
import { useRemote } from '../data/useRemote';

const COLORS = ['#0A3D62', '#4B839F', '#8C5CA6', '#B56826', '#B73D48', '#3C8278', '#64748B', '#91A6B5'];
const tooltipStyle = { background: '#FFFFFF', border: '1px solid #D6E0E2', borderRadius: 8, fontSize: 12 };
interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: MultiSelectFilterProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter(value => value !== option)
      : [...selected, option];

    onChange(next);
  };

  const toggleAll = () => {
    const allVisibleSelected =
      filteredOptions.length > 0 &&
      filteredOptions.every(option => selected.includes(option));

    if (allVisibleSelected) {
      onChange(selected.filter(value => !filteredOptions.includes(value)));
    } else {
      onChange([
        ...new Set([...selected, ...filteredOptions])
      ]);
    }
  };

  return (
    <div className="relative min-w-0">
      <label className="text-sm text-text-secondary">
        {label}
      </label>

      <button
        type="button"
        className="input-base mt-1 flex items-center justify-between text-left"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(value => !value)}
      >
        <span className="truncate">
          {selected.length === 0
            ? `All ${label.toLowerCase()}`
            : `${selected.length} selected`}
        </span>

        <span aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-storm-200 bg-white shadow-lg p-3">
          <input
            type="search"
            className="input-base mb-2"
            placeholder={`Search ${label.toLowerCase()}...`}
            aria-label={`Search ${label.toLowerCase()}`}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />

          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={toggleAll}
            >
              Select all
            </button>

            <button
              type="button"
              className="text-xs text-text-secondary"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2">
            {filteredOptions.map(option => (
              <label
                key={option}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="accent-primary"
                />

                <span>{option}</span>
              </label>
            ))}

            {filteredOptions.length === 0 && (
              <p className="text-sm text-text-muted py-2">
                No matching options found.
              </p>
            )}
          </div>

          <div className="border-t border-storm-200 mt-3 pt-2 flex justify-end">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- active-filter labels shown under the trend chart title ---------- */

/** '2024-01-30' (from a date input) -> 'Jan 30, 2024'. Change this one function to change the format. */
const formatDate = (iso: string, withYear = true) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });

/** "Jan 1 – Jan 30, 2024", "Dec 15, 2023 – Jan 30, 2024", "From Jan 1, 2024", "Up to Jan 30, 2024" or null. */
function dateRangeLabel(f: AnalyticsFilters): string | null {
  if (f.from && f.to) {
    const sameYear = f.from.slice(0, 4) === f.to.slice(0, 4);
    return `${formatDate(f.from, !sameYear)} – ${formatDate(f.to)}`;
  }
  if (f.from) return `From ${formatDate(f.from)}`;
  if (f.to) return `Up to ${formatDate(f.to)}`;
  return null;
}

/* ---------- file names that follow the filters ---------- */

const slug = (text: string) => text.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The filters that are set, as file-name pieces: Cholera, Metro-Manila, 2024-01-01_to_2024-01-30 ... */
function filterNameParts(f: AnalyticsFilters): string[] {
  const parts: string[] = [];

  if (f.disease.length) {
    parts.push(...f.disease.map(slug));
  }

  if (f.province.length) {
    parts.push(...f.province.map(slug));
  }

  if (f.unit) parts.push(slug(f.unit));

  if (f.from && f.to) {
    parts.push(`${f.from}_to_${f.to}`);
  } else if (f.from) {
    parts.push(`from_${f.from}`);
  } else if (f.to) {
    parts.push(`until_${f.to}`);
  }

  return parts.filter(Boolean);
}

/** e.g. AFP_Surveillance_Summary_Cholera_Metro-Manila_2024-01-01_to_2024-01-30.csv (only the filters that are set). */
function exportFileName(f: AnalyticsFilters, format: 'csv' | 'xlsx'): string {
  return `${['AFP_Surveillance_Summary', ...filterNameParts(f)].join('_')}.${format}`;
}

/** e.g. AFP_Surveillance_Weekly-disease-trends_Cholera_2024-01-01_to_2024-01-30.png */
const chartFileName = (
  chart: string,
  f: AnalyticsFilters,
  diseaseOptions: string[] = [],
  provinceOptions: string[] = []
) => {
  const allDiseases =
    f.disease.length === 0 ||
    (diseaseOptions.length > 0 &&
      diseaseOptions.every(name => f.disease.includes(name)));

  const allProvinces =
    f.province.length === 0 ||
    (provinceOptions.length > 0 &&
      provinceOptions.every(name => f.province.includes(name)));

  // Keep filenames short and Windows-safe. List only up to 3 selected names;
  // use counts for larger partial selections and "all-*" for complete selections.
  const diseasePart = allDiseases
    ? 'All-diseases'
    : f.disease.length > 3
      ? `${f.disease.length}-diseases`
      : f.disease.map(slug).join('-');

  const provincePart = allProvinces
    ? 'All-provinces'
    : f.province.length > 3
      ? `${f.province.length}-provinces`
      : f.province.map(slug).join('-');

  const parts = [
    'AFP_Surveillance',
    slug(chart),
    diseasePart,
    provincePart,
    ...(f.unit ? [slug(f.unit).slice(0, 24)] : []),
    ...(f.from && f.to
      ? [`${f.from}_to_${f.to}`]
      : f.from
        ? [`from_${f.from}`]
        : f.to
          ? [`until_${f.to}`]
          : []),
  ].filter(Boolean);

  // Keep the basename comfortably below common Windows filename limits.
  return `${parts.join('_').slice(0, 150).replace(/[_-]+$/g, '')}.png`;
};

/* ---------- download a chart as a PNG (title, filters and legend included) ---------- */

interface ChartImage { title: string; subtitle: string; legend?: { name: string; color: string }[]; note?: string; fileName: string }

async function downloadChartPng(
  container: HTMLElement | null,
  { title, subtitle, legend = [], note, fileName }: ChartImage
) {
  const svg = Array.from(
    container?.querySelectorAll('svg.recharts-surface') ?? []
  ).sort(
    (a, b) =>
      b.getBoundingClientRect().width * b.getBoundingClientRect().height -
      a.getBoundingClientRect().width * a.getBoundingClientRect().height
  )[0];

  if (!svg) throw new Error('The chart is not ready yet.');

  const { width, height } = svg.getBoundingClientRect();
  if (width < 100 || height < 100) throw new Error('The chart is not ready yet.');

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('font-family', 'Arial, Helvetica, sans-serif');

  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    })
  );

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not render the chart image.'));
      img.src = svgUrl;
    });

    const font = 'Arial, Helvetica, sans-serif';
    const scale = 2;
    const pad = 24;
    const innerW = Math.max(width, 480);
    const measure = document.createElement('canvas').getContext('2d');
    if (!measure) throw new Error('Could not prepare the chart legend.');

    // Wrap subtitle text so many selected diseases/provinces remain readable.
    measure.font = `13px ${font}`;
    const subtitleLines: string[] = [];
    if (subtitle) {
      const words = subtitle.split(/\s+/);
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && measure.measureText(candidate).width > innerW) {
          subtitleLines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) subtitleLines.push(line);
    }
    const headerH = subtitleLines.length ? 40 + subtitleLines.length * 18 : 44;
    const noteHeight = note ? 34 : 0;

    // Lay the legend out in rows before sizing the canvas.
    measure.font = `13px ${font}`;
    const items = legend.map(item => ({
      ...item,
      w: 14 + measure.measureText(item.name).width + 22,
    }));
    const rows: (typeof items)[] = [];
    let current: typeof items = [];
    let used = 0;
    for (const item of items) {
      if (used + item.w > innerW && current.length) {
        rows.push(current);
        current = [];
        used = 0;
      }
      current.push(item);
      used += item.w;
    }
    if (current.length) rows.push(current);
    const legendH = rows.length ? rows.length * 22 + 12 : 0;

    const totalW = innerW + pad * 2;
    const totalH = pad + headerH + height + noteHeight + legendH + pad;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(totalW * scale);
    canvas.height = Math.ceil(totalH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create the chart image.');

    ctx.scale(scale, scale);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalW, totalH);
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#0A3D62';
    ctx.font = `bold 20px ${font}`;
    ctx.fillText(title, pad, pad, innerW);

    ctx.fillStyle = '#64748B';
    ctx.font = `13px ${font}`;
    subtitleLines.forEach((line, index) => {
      ctx.fillText(line, pad, pad + 28 + index * 18, innerW);
    });

    const chartY = pad + headerH;
    ctx.drawImage(image, pad, chartY, width, height);

    if (note) {
      ctx.fillStyle = '#64748B';
      ctx.font = `12px ${font}`;
      ctx.fillText(note, pad, chartY + height + 10, innerW);
    }

    ctx.font = `13px ${font}`;
    rows.forEach((row, rowIndex) => {
      let x = pad;
      const legendY = chartY + height + noteHeight + 12 + rowIndex * 22;
      for (const item of row) {
        ctx.fillStyle = item.color;
        ctx.fillRect(x, legendY + 2, 10, 10);
        ctx.fillStyle = '#334155';
        ctx.fillText(item.name, x + 14, legendY);
        x += item.w;
      }
    });

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!blob) throw new Error('Could not create the image file.');

    const pngUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/** Chart title on the left; active-filter pills and a PNG download button on the right (wraps on narrow cards). */
function ChartHeading({ id, title, range, chips, onDownload }: { id: string; title: string; range: string | null; chips: string[]; onDownload?: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 id={id} className="font-semibold text-primary">{title}</h2>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {(range || chips.length > 0) && (
          <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Active filters">
            {range && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                {range}
              </span>
            )}
            {chips.map((chip) => (
              <span key={chip} className="rounded-full border border-storm-200 text-text-secondary px-3 py-1 text-xs">{chip}</span>
            ))}
          </div>
        )}
        {onDownload && (
          <button type="button" onClick={onDownload} aria-label={`Download ${title} as PNG`}
            className="inline-flex items-center gap-1.5 rounded-full border border-storm-200 px-3 py-1 text-xs font-medium text-text-secondary hover:text-primary hover:bg-primary/5">
            <Download className="w-3.5 h-3.5" aria-hidden="true" />PNG
          </button>
        )}
      </div>
    </div>
  );
}

async function downloadCombinedCharts(
  charts: {
    ref: RefObject<HTMLDivElement | null>;
    title: string;
    legend?: { name: string; color: string }[];
    note?: string;
  }[],
  fileName: string,
  reportDetails: string[]
) {
  const renderedCharts = await Promise.all(
    charts.map(async ({ ref, title, legend = [], note }) => {
      const svg = Array.from(
        ref.current?.querySelectorAll('svg.recharts-surface') ?? []
      ).sort(
        (a, b) =>
          b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height
      )[0];

      if (!svg) return null;
      const { width, height } = svg.getBoundingClientRect();
      if (width < 100 || height < 100) return null;

      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
      clone.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
      const svgUrl = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(clone)], {
          type: 'image/svg+xml;charset=utf-8',
        })
      );

      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Could not render ${title}.`));
          img.src = svgUrl;
        });
        return { title, image, width, height, legend, note };
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    })
  );

  const validCharts = renderedCharts.filter(
    (chart): chart is NonNullable<typeof chart> => chart !== null
  );
  if (validCharts.length === 0) {
    throw new Error('No charts are available to download.');
  }

  const scale = 2;
  const padding = 32;
  const chartWidth = 1200;
  const titleHeight = 45;
  const metadataLineHeight = 24;
  const metadataHeight = 35 + reportDetails.length * metadataLineHeight;
  const gap = 40;
  const legendFont = '14px Arial';
  const legendRowHeight = 24;
  const legendTopGap = 10;

  // Calculate wrapped legend rows for each chart before sizing the canvas.
  const legendLayouts = validCharts.map(chart => {
    const items = chart.legend ?? [];
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');

    if (!measureCtx || items.length === 0) {
      return { items: [], rows: [] as { item: { name: string; color: string }; x: number }[], height: 0 };
    }

    measureCtx.font = legendFont;
    const rows: { item: { name: string; color: string }; x: number }[][] = [];
    let currentRow: { item: { name: string; color: string }; x: number }[] = [];
    let x = 0;

    for (const item of items) {
      const itemWidth = 18 + measureCtx.measureText(item.name).width + 24;

      if (x > 0 && x + itemWidth > chartWidth) {
        rows.push(currentRow);
        currentRow = [];
        x = 0;
      }

      currentRow.push({ item, x });
      x += itemWidth;
    }

    if (currentRow.length) rows.push(currentRow);

    return {
      items,
      rows,
      height: rows.length ? legendTopGap + rows.length * legendRowHeight : 0,
    };
  });

  const chartHeights = validCharts.map(
    chart => (chart.height / chart.width) * chartWidth
  );

  const totalHeight =
    padding * 2 +
    metadataHeight +
    validCharts.reduce((total, chart, index) => {
      const noteHeight = chart.note ? 30 : 0;
      return total + titleHeight + chartHeights[index] + noteHeight + legendLayouts[index].height;
    }, 0) +
    gap * (validCharts.length - 1);

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((chartWidth + padding * 2) * scale);
  canvas.height = Math.ceil(totalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the combined image.');

  ctx.scale(scale, scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, chartWidth + padding * 2, totalHeight);
  ctx.textBaseline = 'top';

  let y = padding;
  ctx.fillStyle = '#0A3D62';
  ctx.font = 'bold 26px Arial';
  ctx.fillText('AFP Surveillance Analytics Report', padding, y);
  y += 40;

  ctx.fillStyle = '#475569';
  ctx.font = '14px Arial';
  for (const detail of reportDetails) {
    ctx.fillText(detail, padding, y, chartWidth);
    y += metadataLineHeight;
  }
  y += 15;

  for (const [index, chart] of validCharts.entries()) {
    ctx.fillStyle = '#0A3D62';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(chart.title, padding, y);
    y += titleHeight;

    ctx.drawImage(chart.image, padding, y, chartWidth, chartHeights[index]);
    y += chartHeights[index];

    if (chart.note) {
      ctx.fillStyle = '#64748B';
      ctx.font = '13px Arial';
      ctx.textBaseline = 'top';
      ctx.fillText(chart.note, padding, y + 8, chartWidth);
      y += 30;
    }

    const legendLayout = legendLayouts[index];
    if (legendLayout.rows.length > 0) {
      ctx.font = legendFont;
      ctx.textBaseline = 'middle';
      y += legendTopGap;

      legendLayout.rows.forEach((row, rowIndex) => {
        for (const entry of row) {
          const itemY = y + rowIndex * legendRowHeight;
          ctx.fillStyle = entry.item.color;
          ctx.fillRect(padding + entry.x, itemY + 5, 12, 12);
          ctx.fillStyle = '#334155';
          ctx.fillText(entry.item.name, padding + entry.x + 18, itemY + 11);
        }
      });

      y += legendLayout.rows.length * legendRowHeight;
      ctx.textBaseline = 'top';
    }

    y += gap;
  }

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('Could not create the PNG file.');

  const pngUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = pngUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
}

export function AnalyticsDashboard({ allowExport = false }: { allowExport?: boolean }) {
  const { role, profile, canAdministerSurveillance } = useAuth();
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const load = useCallback(() => loadAnalytics(filters), [filters]);
  const [downloadingAllCharts, setDownloadingAllCharts] = useState(false);
  const state = useRemote(load);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const data = state.data;
  const series = useMemo(() => data ? trendSeries(data) : { names: [], rows: [] }, [data]);
  const provinces = useMemo(() => {
    if (!data) return [];
    const top = data.byProvince.slice(0, 6);
    if (data.byProvince.length > 6) {
      top.push({
        name: 'OTHER PROVINCES',
        count: data.byProvince.slice(6).reduce((n, row) => n + row.count, 0),
      });
    }
    return top;
  }, [data]);
  const trendRef = useRef<HTMLDivElement>(null);
  const diseaseRef = useRef<HTMLDivElement>(null);
  const provinceRef = useRef<HTMLDivElement>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  // Empty selections mean "all"; explicitly selecting every available option
  // should be treated the same way in chart subtitles and report metadata.
  const isAllSelected = (selected: string[], options: string[]) =>
    selected.length === 0 ||
    (options.length > 0 && options.every(option => selected.includes(option)));

  const diseaseSelectionLabel = (selected: string[]) => {
    const options = data?.options.diseases ?? [];
    if (isAllSelected(selected, options)) return 'All diseases';
    return selected.length > 10
      ? `${selected.length} diseases selected`
      : selected.join(', ');
  };

  const provinceSelectionLabel = (selected: string[]) => {
    const options = data?.options.provinces ?? [];
    if (isAllSelected(selected, options)) return 'All provinces';
    return selected.length > 10
      ? `${selected.length} provinces selected`
      : selected.join(', ');
  };
  
  const saveChart = async (
  ref: RefObject<HTMLDivElement | null>,
  fileKey: string,
  title: string,
  chartFilters: AnalyticsFilters,
  legend: { name: string; color: string }[] = []
) => {
  setChartError(null);

  try {
    const provinceSummary = provinceSelectionLabel(chartFilters.province);
    const diseaseSummary = diseaseSelectionLabel(chartFilters.disease);

    const isProvinceChart = fileKey === 'Records-by-province';
    const subtitle = [
      dateRangeLabel(chartFilters) ?? 'All reporting dates',
      ...(isProvinceChart ? [diseaseSummary] : []),
      provinceSummary,
      chartFilters.unit ? `Unit: ${chartFilters.unit}` : null,
    ].filter(Boolean).join(' | ');

    await downloadChartPng(ref.current, {
      title,
      subtitle,
      legend,
      note: isProvinceChart
        ? 'Top 6 provinces by record count are shown. All remaining provinces are grouped as Other Provinces.'
        : undefined,
      fileName: chartFileName(
        fileKey,
        chartFilters,
        data?.options.diseases ?? [],
        data?.options.provinces ?? []
      ),
    });
  } catch (error) {
    setChartError(
      error instanceof Error
        ? error.message
        : 'Could not download this chart.'
    );
  }
};
const downloadAllCharts = async () => {
  if (downloadingAllCharts || !data) return;

  setDownloadingAllCharts(true);
  setChartError(null);

  try {
    await downloadCombinedCharts(
  [
    ...(series.rows.length > 0
      ? [{
          ref: trendRef,
          title: 'Weekly Disease Trends',
          legend: series.names.map((name, index) => ({
            name,
            color: COLORS[index % COLORS.length],
          })),
        }]
      : []),
    { ref: diseaseRef, title: 'Records by Disease' },
    {
  ref: provinceRef,
  title: 'Records by Province',
  note: 'Top 6 provinces by record count are shown. All remaining provinces are grouped as Other Provinces.',
  legend: provinces.map((row, index) => ({
    name: `${row.name} (${row.count.toLocaleString()})`,
    color: COLORS[index % COLORS.length],
  })),
},
  ],
  'AFP_Surveillance_All_Charts.png',
  [
    `Reporting date range: ${dateRangeLabel(filters) ?? 'All reporting dates'}`,
    `Selected diseases: ${diseaseSelectionLabel(filters.disease)}`,
    `Selected provinces: ${provinceSelectionLabel(filters.province)}`,
    `Assigned unit: ${
      role.id === 'it-personnel'
        ? filters.unit || 'All units'
        : profile.assignedUnit || 'Not assigned'
    }`,
  ]
);
  } catch (error) {
    setChartError(
      error instanceof Error
        ? error.message
        : 'Could not download all charts.'
    );
  } finally {
    setDownloadingAllCharts(false);
  }
};

  const rangeLabel = dateRangeLabel(filters);
  const filterChips = [...filters.disease,...filters.province,filters.unit].filter(Boolean);
const change = <K extends keyof AnalyticsFilters>(
  key: K,
  value: AnalyticsFilters[K]
) => {
  setFilters(previous => ({
    ...previous,
    [key]: value
  }));

  setExportMessage(null);
  setExportError(null);
};  const exportView = async (format: 'csv' | 'xlsx') => {
    if (!canAdministerSurveillance() || state.loading || exporting) return;
    setExporting(true); setExportMessage(null); setExportError(null);
    try {
      const rows = await exportAnalytics(filters, format);
      const fileName = exportFileName(filters, format);
      downloadSummary(rows, format, fileName);
      setExportMessage(`Downloaded ${rows.length} aggregate groups as ${fileName}. The export was recorded in the audit log.`);
    } catch (error) { setExportError(error instanceof Error ? error.message : 'Could not export this view.'); }
    finally { setExporting(false); }
  };
  return <div className="space-y-6">
    <section className="card p-5 space-y-4" aria-label="Surveillance filters" data-tour="filter-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">{role.id === 'it-personnel' ? 'Scope: all assigned units, subject to filters.' : `Scope: ${profile.assignedUnit}`}</p>
        <button type="button" className="btn-secondary" disabled={state.loading} onClick={state.refresh}><RefreshCw className="w-4 h-4" aria-hidden="true" />Refresh analytics</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <label className="text-sm text-text-secondary">Reported from<input aria-label="Reported from" type="date" className="input-base mt-1" value={filters.from} onChange={e => change('from', e.target.value)} /></label>
        <label className="text-sm text-text-secondary">Reported through<input aria-label="Reported through" type="date" className="input-base mt-1" value={filters.to} onChange={e => change('to', e.target.value)} /></label>
        <MultiSelectFilter label="Disease" options={data?.options.diseases ?? []} selected={filters.disease} onChange={values => change('disease', values)}/>
        <MultiSelectFilter label="Province" options={data?.options.provinces ?? []} selected={filters.province} onChange={values => change('province', values)} />
        {role.id === 'it-personnel' && <label className="text-sm text-text-secondary">Assigned unit<select aria-label="Assigned unit" className="input-base mt-1" value={filters.unit} onChange={e => change('unit', e.target.value)}><option value="">All units</option>{data?.options.units.map(name => <option key={name}>{name}</option>)}</select></label>}
      </div>
      <button type="button" className="btn-ghost" onClick={() => setFilters({ ...EMPTY_FILTERS })}>Clear analytics filters</button>
    </section>
    {chartError && <p role="alert" className="text-sm text-status-danger">{chartError}</p>}
    {state.loading && <p role="status" className="text-sm text-text-muted">Loading current surveillance data...</p>}
    {state.error && <p role="alert" className="card p-4 text-status-danger">{state.error}</p>}
    {data && !state.error && <>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Surveillance totals" data-tour="kpi-cards">
        {[
          ['Uploaded records', data.totalRecords], ['Diseases reported', data.distinctDiseases],
          ['Confirmed cases', data.confirmedCases], ['Records with missing values', data.missingValueRecords],
        ].map(([label, count]) => <article key={label} className="kpi-card"><p className="kpi-label">{label}</p><p className="kpi-value" data-testid={label === 'Uploaded records' ? 'record-total' : undefined}>{Number(count).toLocaleString()}</p></article>)}
      </section>
      <div className="flex justify-end">
  <button
    type="button"
    className="btn-primary"
    onClick={() => void downloadAllCharts()}
    disabled={downloadingAllCharts || state.loading}
  >
    <Download className="w-4 h-4" aria-hidden="true" />
    {downloadingAllCharts
      ? 'Downloading charts...'
      : 'Download All Charts (PNG)'}
  </button>
</div>
      <p className="text-sm text-text-secondary">Latest reporting date: <strong>{data.latestReportDate ?? 'No dated records'}</strong>. Latest reported week: {data.currentWeekCount} records; preceding week: {data.previousWeekCount}. {data.weeklyChange === null ? 'No preceding-week baseline for a percentage change.' : `Change: ${data.weeklyChange > 0 ? '+' : ''}${data.weeklyChange}%.`}</p>
      <p className="text-xs text-text-muted">Counts represent uploaded rows, not deduplicated patients. Week comparisons use the latest reporting date in the filtered data. Missing or invalid RP DATE values are included in all-time totals and excluded from dated charts and date-range filters ({data.undatedRecords} in the current view).</p>
      {data.totalRecords === 0 ? <section className="card p-8 text-center text-text-secondary">No uploaded records match this view. Upload a standardized workbook or clear the filters.</section> : <>
        <section className="card p-5" aria-labelledby="trend-heading"><ChartHeading id="trend-heading" title="Weekly disease trends" range={rangeLabel} chips={filterChips} onDownload={series.rows.length ? () => saveChart(trendRef, 'Weekly-disease-trends', 'Weekly disease trends', filters, series.names.map((name, index) => ({ name, color: COLORS[index % COLORS.length] }))) : undefined} />
          {series.rows.length ? <div
  ref={trendRef}
  style={{ height: Math.max(320, series.names.length * 45) }}
><ResponsiveContainer width="100%" height="100%"><LineChart data={series.rows} margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Legend />
            {series.names.map((name, index) => <Line isAnimationActive={false} key={name} type="linear" dataKey={`series_${index}`} name={name} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />)}
          </LineChart></ResponsiveContainer></div> : <p className="text-sm text-text-muted">No valid reporting dates are available for a trend chart.</p>}
          <p className="text-xs text-text-muted mt-2">
  Weeks start Monday. All diseases matching the current filters are displayed.
</p>
        </section>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="card p-5" aria-labelledby="disease-heading"><ChartHeading id="disease-heading" title="Records by disease" range={null} chips={filters.disease} onDownload={() => saveChart(diseaseRef, 'Records-by-disease', 'Records by disease', filters)} /><div
  ref={diseaseRef}
  style={{
    height: Math.max(
      320,
      data.byDisease.filter(row => row.name !== '(missing)').length * 36
    ),
  }}
><ResponsiveContainer width="100%" height="100%"><BarChart data={data.byDisease.filter(row => row.name !== '(missing)')} layout="vertical" margin={{ left: 15, right: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Bar isAnimationActive={false} dataKey="count" name="Records" fill="#0A3D62" /></BarChart></ResponsiveContainer></div><p className="text-xs text-text-muted"> All diseases matching the current filters are displayed. </p></section>
          <section className="card p-5" aria-labelledby="province-heading"><ChartHeading id="province-heading" title="Records by province" range={null} chips={filters.province} onDownload={() => saveChart(
  provinceRef,
  'Records-by-province',
  'Records by province',
  filters,
  provinces.map((row, index) => ({
    name: `${row.name} (${row.count.toLocaleString()})`,
    color: COLORS[index % COLORS.length],
  }))
)} /><div ref={provinceRef} style={{ height: 320 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie isAnimationActive={false} data={provinces} dataKey="count" nameKey="name" innerRadius={50} outerRadius={90}>{provinces.map((row, index) => <Cell key={row.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div><p className="text-xs text-text-muted mt-2 mb-3">Top 6 provinces by record count are shown. All remaining provinces are grouped as Other Provinces.</p><ul className="space-y-1 text-sm">{provinces.map((row, index) => <li key={row.name} className="flex justify-between gap-3"><span><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: COLORS[index % COLORS.length] }} />{row.name}</span><span className="font-mono">{row.count.toLocaleString()}</span></li>)}</ul></section>
        </div>
        <section className="card p-5"><h2 className="font-semibold text-primary mb-3">Records by assigned unit</h2><ul className="divide-y divide-storm-200">{data.byUnit.map(row => <li key={row.name} className="flex justify-between gap-4 py-2 text-sm"><span>{row.name}</span><span className="font-mono">{row.count.toLocaleString()}</span></li>)}</ul></section>
      </>}
      {allowExport && <section className="card p-5 space-y-3" data-tour="privacy-export" aria-label="Aggregate exports">
        <h2 className="font-semibold text-primary">Export current view</h2><p className="text-sm text-text-secondary">Exports group counts by reporting week, disease, province, assigned unit, reporting unit, classification, sex and five-year age band. Names, case IDs, ranks and service identifiers are excluded.</p>
        {canAdministerSurveillance() ? <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={exporting || state.loading} onClick={() => { void exportView('csv'); }}><Download className="w-4 h-4" aria-hidden="true" />Export summary CSV</button><button className="btn-secondary" disabled={exporting || state.loading} onClick={() => { void exportView('xlsx'); }}>Export summary Excel</button></div> : <p className="text-sm text-text-muted">Your role has view-only surveillance access. Export requires full surveillance access.</p>}
        {exporting && <p role="status">Preparing export...</p>}{exportMessage && <p role="status" className="text-sm text-status-success">{exportMessage}</p>}{exportError && <p role="alert" className="text-sm text-status-danger">{exportError}</p>}
      </section>}
    </>}
  </div>;
}