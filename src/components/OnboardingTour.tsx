import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Check, HelpCircle, MousePointerClick } from 'lucide-react';

export type TourTab = 'home' | 'data-management' | 'analysis-export' | 'account-settings';

export interface TourStep {
  target: string;
  tab: TourTab;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: 'module-nav',
    tab: 'home',
    title: 'Navigate the modules',
    description:
      'Use the module bar to move between DATA MANAGEMENT (import standardized spreadsheets) and ANALYSIS & EXPORT (charts, filters and record tables). Your access level determines which modules are visible.',
  },
  {
    target: 'kpi-cards',
    tab: 'home',
    title: 'KPI summary cards',
    description:
      'Total Cases, Affected Units, Most Common Disease and Active Alerts give you an at-a-glance read of the current surveillance picture. Each card shows the trend against the previous reporting period.',
  },
  {
    target: 'filter-panel',
    tab: 'analysis-export',
    title: 'Analytics filter panel',
    description:
      'Narrow the analysis by date range, region, AFP command, disease, rank and case status. Filters apply across every chart and the records table below.',
    placement: 'right',
  },
  {
    target: 'dropzone',
    tab: 'data-management',
    title: 'Upload standardized Excel file',
    description:
      'Drag and drop the official HSEU template here. The system validates every row against the data dictionary before insert, and flags missing fields, formatting errors and duplicates.',
  },
  {
    target: 'privacy-export',
    tab: 'analysis-export',
    title: 'Privacy and export actions',
    description:
      'Export the current view for DOH or upper command. Identifiers are stripped automatically and aggregate summaries are the only format permitted for external reporting.',
  },
];

interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTourProps {
  activeTab: TourTab;
  onNavigate: (tab: TourTab) => void;
  onClose: () => void;
}

const PAD = 8;
const TOOLTIP_W = 360;
const GAP = 14;

export function OnboardingTour({ activeTab, onNavigate, onClose }: OnboardingTourProps) {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tipBox, setTipBox] = useState<{ top: number; left: number } | null>(null);

  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setSpot(null);
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setSpot(null);
        return;
      }
      setSpot({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      });
    }, 320);
  }, [step.target]);

  /* Navigate to the tab that owns the current step, then measure. */
  useEffect(() => {
    if (activeTab !== step.tab) {
      onNavigate(step.tab);
      return;
    }
    measure();
  }, [index, activeTab, step.tab, measure, onNavigate]);

  /* Keep the spotlight pinned while the user scrolls or resizes. */
  useEffect(() => {
    if (!spot) return;
    const onScroll = () => measure();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [spot, measure]);

  /* Escape closes the tour. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Position the popover inside the viewport. */
  useLayoutEffect(() => {
    if (!spot || !tooltipRef.current) {
      setTipBox(null);
      return;
    }
    const h = tooltipRef.current.offsetHeight;
    const placement = step.placement ?? 'bottom';
    let top: number;
    let left: number;

    if (placement === 'right') {
      top = spot.top;
      left = spot.left + spot.width + GAP;
    } else if (placement === 'top') {
      top = spot.top - h - GAP;
      left = spot.left;
    } else if (placement === 'left') {
      top = spot.top;
      left = spot.left - TOOLTIP_W - GAP;
    } else {
      top = spot.top + spot.height + GAP;
      left = spot.left;
    }

    /* Flip vertically when there is no room. */
    if (top + h > window.innerHeight - 12) {
      top = spot.top - h - GAP;
    }
    if (top < 12) {
      top = Math.min(spot.top + spot.height + GAP, window.innerHeight - h - 12);
    }
    /* Clamp horizontally. */
    left = Math.min(Math.max(12, left), window.innerWidth - TOOLTIP_W - 12);

    setTipBox({ top, left });
  }, [spot, step.placement]);

  const next = () => (isLast ? onClose() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <>
      {/* Dimmed layer, click to dismiss */}
      <div
        className="fixed inset-0 z-40 bg-black/75"
        onClick={onClose}
        role="presentation"
      />

      {/* Spotlight cut-out + focus ring */}
      {spot && (
        <>
          <div
            className="fixed z-[41] rounded-xl pointer-events-none"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
              transition: 'all 220ms ease-out',
            }}
            aria-hidden="true"
          />
          <div
            className="fixed z-50 rounded-xl ring-4 ring-sky-400 shadow-2xl pointer-events-none"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              transition: 'all 220ms ease-out',
            }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Popover */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Onboarding step ${index + 1} of ${TOUR_STEPS.length}`}
        className="fixed z-[60] w-[360px] max-w-[calc(100vw-24px)] bg-background-card border border-storm-200 rounded-xl shadow-2xl"
        style={
          tipBox
            ? { top: tipBox.top, left: tipBox.left, transition: 'all 220ms ease-out' }
            : { top: -9999, left: -9999, opacity: 0 }
        }
      >
        <div className="flex items-start gap-3 p-4 pb-3">
          <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-accent-teal/10 text-accent-teal flex items-center justify-center">
            {isLast ? <Check className="w-5 h-5" aria-hidden="true" /> : <MousePointerClick className="w-5 h-5" aria-hidden="true" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-muted tabular-nums">
              Step {index + 1} of {TOUR_STEPS.length}
            </p>
            <h2 className="text-base font-semibold text-primary mt-0.5">{step.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-primary/5 flex-shrink-0"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <p className="px-4 pb-4 text-sm text-text-secondary leading-relaxed">{step.description}</p>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-storm-200">
          <button onClick={onClose} className="btn-ghost text-text-muted">
            Skip
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-1" aria-hidden="true">
              {TOUR_STEPS.map((s, i) => (
                <span
                  key={s.target}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-5 bg-accent-teal' : 'w-1.5 bg-storm-200'
                  }`}
                />
              ))}
            </div>
            <button onClick={back} disabled={index === 0} className="btn-secondary px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Back
            </button>
            <button onClick={next} className="btn-primary px-3 py-1.5">
              {isLast ? 'Finish' : 'Next'}
              {isLast ? <Check className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** "Need help? / Take Tour" trigger for the top navigation bar. */
export function TourTrigger({ onStart }: { onStart: () => void }) {
  return (
    <button
      onClick={onStart}
      className="btn-ghost flex items-center gap-1.5 whitespace-nowrap text-accent-teal hover:text-primary"
      data-tour="take-tour"
    >
      <HelpCircle className="w-4 h-4" aria-hidden="true" />
      <span className="hidden sm:inline">Need help?</span> Take Tour
    </button>
  );
}
