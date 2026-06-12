import React, { useState } from 'react';
import { StarIcon, Loader2Icon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { reviewsApi } from '../../utils/ordersApi';
import { useToastStore } from '../../store/toastStore';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  productId: number;
  productName: string;
}

export function ReviewModal({ isOpen, onClose, orderId, productId, productName }: ReviewModalProps) {
  const showToast = useToastStore((s) => s.showToast);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return showToast('Please select a rating', 'warning');
    if (body.length < 20) return showToast('Review must be at least 20 characters', 'warning');
    if (!orderId || !productId) {
      showToast('Unable to submit review right now. Please refresh and try again.', 'error');
      return;
    }

    setLoading(true);
    try {
      await reviewsApi.create({ product_id: productId, order_id: orderId, rating, title, body });
      showToast('Review submitted!', 'success');
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      // FastAPI 422 returns detail as an array of validation error objects
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.msg).join(', ')
        : typeof detail === 'string'
        ? detail
        : 'Failed to submit review';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const labels: Record<number, string> = {
    1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Review: ${productName}`}>
      <div className="space-y-4">
        {/* Star rating */}
        <div>
          <p className="text-sm text-muted mb-2">Your rating</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(star)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <StarIcon
                  size={28}
                  className={`${(hovered || rating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} transition-colors`}
                />
              </button>
            ))}
            {(hovered || rating) > 0 && (
              <span className="ml-2 text-sm font-medium text-ink">{labels[hovered || rating]}</span>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-muted font-medium block mb-1">Review Title</label>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Summarize your experience..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* Body */}
        <div>
          <label className="text-xs text-muted font-medium block mb-1">Review (min 20 characters)</label>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={4}
            placeholder="Share your experience with this product..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-xs text-muted text-right mt-0.5">{body.length}/500</p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={loading || rating === 0 || body.length < 20}>
            {loading ? <Loader2Icon size={14} className="animate-spin" /> : 'Submit Review'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}