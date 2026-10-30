import { useState } from 'react';
import { CornerDownRight, MessageSquare, Reply, Send } from 'lucide-react';

export default function CommentThread({
  comments = [],
  onAddComment,
  disabled = false,
}) {
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  // Group comments into root comments and their replies
  const rootComments = comments.filter((c) => !c.parent_id);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {});

  const handlePostRoot = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || busy) return;

    setBusy(true);
    try {
      await onAddComment(newCommentText.trim(), null);
      setNewCommentText('');
    } finally {
      setBusy(false);
    }
  };

  const handlePostReply = async (parentId) => {
    if (!replyText.trim() || busy) return;

    setBusy(true);
    try {
      await onAddComment(replyText.trim(), parentId);
      setReplyText('');
      setReplyingToId(null);
    } finally {
      setBusy(false);
    }
  };

  const renderComment = (c, isReply = false) => {
    const isReplying = replyingToId === c.id;
    const replies = repliesByParent[c.id] || [];

    return (
      <div
        key={c.id || `${c.author}-${c.created_at}`}
        className={`rounded-xl border transition-all ${
          isReply
            ? 'border-slate-200/70 bg-white ml-6 mt-2'
            : c.role === 'manager'
            ? 'border-amber-200 bg-amber-50/40'
            : c.role === 'reviewer'
            ? 'border-emerald-200 bg-emerald-50/40'
            : 'border-slate-200 bg-white'
        } p-3.5`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {isReply && <CornerDownRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
            <strong className="text-slate-800">{c.author || 'Reviewer'}</strong>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                c.role === 'manager'
                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                  : c.role === 'reviewer'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {c.role || 'user'}
            </span>
            {c.version && (
              <span className="text-[10px] text-slate-400 font-mono">
                on v{c.version}
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-400">
            {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
          </span>
        </div>

        <p className="mt-2 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
          {c.text}
        </p>

        {/* Reply Action Trigger */}
        {!isReply && onAddComment && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (isReplying) {
                  setReplyingToId(null);
                  setReplyText('');
                } else {
                  setReplyingToId(c.id);
                  setReplyText('');
                }
              }}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
            >
              <Reply className="h-3 w-3" />
              <span>{isReplying ? 'Cancel reply' : 'Reply'}</span>
            </button>
          </div>
        )}

        {/* Inline Reply Form */}
        {isReplying && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Replying to ${c.author || 'comment'}...`}
                className="field text-xs py-1.5 flex-1"
                autoFocus
              />
              <button
                type="button"
                disabled={busy || !replyText.trim()}
                onClick={() => handlePostReply(c.id)}
                className="btn-primary text-xs py-1.5 px-3 shrink-0"
              >
                <Send className="h-3 w-3" />
                <span>Post reply</span>
              </button>
            </div>
          </div>
        )}

        {/* Nested Replies */}
        {replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <MessageSquare className="h-4 w-4 text-indigo-600" />
          <span>Discussion & Comments ({comments.length})</span>
        </div>
      </div>

      {/* Comment List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {rootComments.length > 0 ? (
          rootComments.map((c) => renderComment(c, false))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
            No comments yet. Start the conversation below.
          </div>
        )}
      </div>

      {/* New Top-Level Comment Input */}
      {onAddComment && (
        <form onSubmit={handlePostRoot} className="pt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Add a comment or feedback for reviewers..."
              className="field text-xs flex-1"
              disabled={disabled}
            />
            <button
              type="submit"
              disabled={disabled || busy || !newCommentText.trim()}
              className="btn-secondary text-xs py-2 px-3.5 shrink-0 flex items-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Post</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
