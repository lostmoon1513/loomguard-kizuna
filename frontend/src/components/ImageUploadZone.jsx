import { useState, useRef } from 'react';
import { FileUp, Image as ImageIcon, Sparkles, X, AlertTriangle } from 'lucide-react';

/**
 * ImageUploadZone component for LoomGuard Image Drafts:
 * Accepts PNG / JPG up to 5 MB.
 * Content-checked per contract_v2 §8: POST /api/drafts/image
 * Warns about masking limitation on images.
 */
export default function ImageUploadZone({
  onCheckImage,
  disabled = false,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [useAi, setUseAi] = useState(true);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (file) => {
    setError('');
    if (!file) return;

    // Check MIME type
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Unsupported file type. Please upload a PNG or JPG banner image (contract_v2: UNSUPPORTED_IMAGE).');
      return;
    }

    // Check size limit: max 5 MB
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError('Image exceeds 5 MB limit. Please upload a smaller image file (contract_v2: IMAGE_TOO_LARGE).');
      return;
    }

    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }

    // Generate local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a PNG or JPG banner image to check.');
      return;
    }

    onCheckImage({
      file: selectedFile,
      title: title.trim() || selectedFile.name,
      useAi,
    });
  };

  return (
    <div className="space-y-4">
      {/* Confidential text warning per contract_v2 §8 */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong>Privacy Notice (Images cannot be masked):</strong>
          <span className="ml-1 text-amber-900">
            Text inside images cannot be masked. If your banner contains confidential names or numbers, please turn AI off before uploading.
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Banner / Graphic title
          </label>
          <input
            type="text"
            className="field text-xs"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q4 Aurora Launch Banner (1200x630)"
          />
        </div>

        {/* Drag and Drop Box */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleFileChange(dropped);
          }}
          className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
            previewUrl
              ? 'border-indigo-300 bg-indigo-50/20'
              : 'border-slate-300 bg-slate-50 hover:bg-slate-100/60'
          }`}
        >
          {previewUrl ? (
            <div className="space-y-3">
              <div className="relative inline-block max-h-56 max-w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <img
                  src={previewUrl}
                  alt="Selected banner preview"
                  className="max-h-56 w-auto object-contain mx-auto"
                />
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1.5 text-white hover:bg-slate-900 transition-colors"
                  title="Remove selected image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600">
                <strong className="text-slate-800">{selectedFile?.name}</strong> ·{' '}
                {(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100/80 text-indigo-700">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Drop your PNG or JPG banner here, or{' '}
                  <label className="cursor-pointer text-indigo-600 hover:text-indigo-800 underline">
                    browse
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={(e) => handleFileChange(e.target.files?.[0])}
                    />
                  </label>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Supports PNG and JPG up to 5 MB. Analyzes brand palette, WCAG contrast, and logo placement.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* AI & Submit controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
              className="h-4 w-4 rounded-md accent-indigo-600"
            />
            <span>Enable Gemini Vision layout & text location</span>
          </label>

          <button
            type="submit"
            disabled={disabled || !selectedFile}
            className="btn-primary text-xs py-2 px-5"
          >
            <Sparkles className="h-4 w-4" />
            <span>Check image draft</span>
          </button>
        </div>
      </form>
    </div>
  );
}
