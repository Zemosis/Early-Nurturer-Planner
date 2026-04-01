/**
 * ScheduleBlockEditor - Mobile bottom sheet and desktop modal for editing schedule blocks
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Tag, FileText, Trash2, Save } from 'lucide-react';
import { ScheduleBlock, formatTime12Hour, calculateDuration } from 'shared';

interface ScheduleBlockEditorProps {
  block: ScheduleBlock | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ScheduleBlock>) => void;
  onDelete?: () => void;
}

const categoryOptions = [
  { value: 'circle', label: 'Circle Time', color: '#7A9B76' },
  { value: 'yoga', label: 'Yoga Time', color: '#9B8FCC' },
  { value: 'theme', label: 'Theme Activity', color: '#F4B740' },
  { value: 'gross-motor', label: 'Gross Motor', color: '#D4845B' },
  { value: 'sensory', label: 'Sensory Activity', color: '#7FABBB' },
  { value: 'free-play', label: 'Free Play', color: '#E8A5B8' },
  { value: 'transition', label: 'Transition', color: '#C8B6A6' },
  { value: 'routine', label: 'Daily Routine', color: '#B8B8B8' },
];

export function ScheduleBlockEditor({
  block,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: ScheduleBlockEditorProps) {
  const [formData, setFormData] = useState({
    title: '',
    startTime: '08:00',
    endTime: '08:30',
    category: 'routine' as ScheduleBlock['category'],
    description: '',
    notes: '',
  });

  useEffect(() => {
    if (block) {
      setFormData({
        title: block.title,
        startTime: block.startTime,
        endTime: block.endTime,
        category: block.category,
        description: block.description,
        notes: block.notes || '',
      });
    }
  }, [block]);

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && confirm('Are you sure you want to delete this activity?')) {
      onDelete();
      onClose();
    }
  };

  const duration = calculateDuration(formData.startTime, formData.endTime);
  const selectedCategory = categoryOptions.find(c => c.value === formData.category);

  if (!isOpen || !block) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-50 lg:flex lg:items-center lg:justify-center"
      >
        {/* Mobile: Bottom Sheet */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto lg:relative lg:rounded-3xl lg:max-w-lg lg:w-full lg:max-h-[90vh]"
        >
          {/* Handle (mobile only) */}
          <div className="lg:hidden flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-muted rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">
              {block.id.startsWith('block-') ? 'Edit Activity' : 'Edit Activity'}
            </h2>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Activity Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="e.g., Morning Circle Time"
              />
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Start Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  End Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Duration Display */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 rounded-xl">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Duration: <strong className="text-foreground">{duration} minutes</strong>
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {formatTime12Hour(formData.startTime)} – {formatTime12Hour(formData.endTime)}
              </span>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Activity Type
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ScheduleBlock['category'] })}
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none bg-white"
                  style={{ color: selectedCategory?.color }}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                placeholder="Brief description of the activity"
              />
            </div>

            {/* Notes (Optional) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Notes <span className="text-muted-foreground text-xs">(Optional)</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                  placeholder="Add any special notes or adaptations..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 pt-4 border-t border-border space-y-3">
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 bg-primary text-white px-6 py-3.5 rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="px-5 py-3.5 border-2 border-destructive text-destructive rounded-xl font-medium hover:bg-destructive/10 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 border border-border text-muted-foreground rounded-xl font-medium hover:bg-muted/50 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}