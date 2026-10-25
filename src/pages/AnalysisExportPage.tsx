import { AnalyticsDashboard } from '../components/AnalyticsDashboard';

export function AnalysisExportPage() {
  return <div className="space-y-6"><header><h1 className="text-2xl font-bold text-primary">Analysis &amp; Export</h1><p className="text-text-secondary mt-1">Current surveillance data from uploaded records</p></header><AnalyticsDashboard allowExport /></div>;
}
