import { useState, useRef, useEffect } from 'react';

/**
 * ImageViewer component:
 * Fetches image bytes via Bearer token (GET /api/drafts/{id}/image?version=n).
 * Draws interactive bounding boxes scaled to displayed size using issue.region {x, y, w, h} (0..1 coordinates).
 * Accessible via keyboard focus and aria-labels.
 */
export default function ImageViewer({
  imageUrl,
  issues = [],
  activeIssueId = null,
  onSelectIssue,
  _elements = [],
  imageMeta = null,
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [showBoxes, setShowBoxes] = useState(true);

  // Update box container size on window resize or image load
  const updateSize = () => {
    if (imgRef.current) {
      setImgDimensions({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Filter issues with valid region coordinates
  const regionIssues = issues.filter(
    (issue) =>
      issue.region &&
      typeof issue.region.x === 'number' &&
      typeof issue.region.y === 'number',
  );

  return (
    <div className="space-y-3">
      {/* Viewer controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">Banner Inspection View</span>
          {imageMeta && (
            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-mono text-slate-600">
              {imageMeta.width || imageMeta.original_width} × {imageMeta.height || imageMeta.original_height} px · {imageMeta.format || 'PNG'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={showBoxes}
              onChange={(e) => setShowBoxes(e.target.checked)}
              className="accent-indigo-600 rounded-sm"
            />
            <span>Show finding regions ({regionIssues.length})</span>
          </label>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        ref={containerRef}
        className="relative mx-auto flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/5 p-2 shadow-xs"
      >
        <div className="relative inline-block max-w-full">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Checked brand banner"
            onLoad={updateSize}
            className="max-h-[550px] w-auto max-w-full rounded-xl object-contain shadow-xs block"
          />

          {/* Overlay Boxes */}
          {showBoxes &&
            imgDimensions.width > 0 &&
            regionIssues.map((issue, idx) => {
              const { x, y, w, h } = issue.region;
              const isSelected = activeIssueId === issue.id;

              // Convert 0..1 coordinates to pixels
              const boxStyle = {
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: `${w * 100}%`,
                height: `${h * 100}%`,
              };

              const isMandatory = issue.priority === 'mandatory' || issue.category === 'ACCESSIBILITY';

              return (
                <button
                  key={issue.id || idx}
                  type="button"
                  tabIndex={0}
                  role="button"
                  aria-label={`${issue.category} finding region ${idx + 1}: ${issue.reason}`}
                  onClick={() => onSelectIssue && onSelectIssue(issue.id)}
                  style={boxStyle}
                  className={`absolute rounded-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-3 border-indigo-600 bg-indigo-600/25 ring-2 ring-white z-20 shadow-md'
                      : isMandatory
                      ? 'border-2 border-rose-500 bg-rose-500/15 hover:bg-rose-500/30 z-10'
                      : 'border-2 border-amber-500 bg-amber-500/15 hover:bg-amber-500/30 z-10'
                  }`}
                >
                  {/* Pin Number Badge */}
                  <span
                    className={`absolute -top-3 -left-3 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white shadow-xs ${
                      isSelected
                        ? 'bg-indigo-600 ring-2 ring-white'
                        : isMandatory
                        ? 'bg-rose-600'
                        : 'bg-amber-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
