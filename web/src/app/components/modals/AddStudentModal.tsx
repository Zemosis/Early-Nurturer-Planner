import { useState } from "react";
import { X, Upload, User } from "lucide-react";
import { Student } from 'shared';

interface AddStudentModalProps {
  onClose: () => void;
  onAdd: (student: Omit<Student, 'id' | 'createdAt' | 'age'>) => void;
}

export function AddStudentModal({ onClose, onAdd }: AddStudentModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    birthdate: "",
    photo: undefined as string | undefined,
    tags: [] as string[],
    notes: "",
    isActive: true,
  });
  const [newTag, setNewTag] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.birthdate) {
      alert("Please fill in required fields");
      return;
    }
    onAdd(formData);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Add New Student</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create a student profile for documentation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted/20 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Photo (Optional)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden">
                {formData.photo ? (
                  <img
                    src={formData.photo}
                    alt="Student"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 hover:bg-muted/60 rounded-xl cursor-pointer transition-colors text-sm font-medium">
                  <Upload className="w-4 h-4" />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  JPG, PNG up to 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Student Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Emma Martinez"
              className="w-full px-4 py-2.5 bg-input-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
            />
          </div>

          {/* Birthdate */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Birthdate <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.birthdate}
              onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2.5 bg-input-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Age group will be automatically calculated
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Tags (Optional)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="e.g., special needs, new student"
                className="flex-1 px-4 py-2.5 bg-input-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2.5 bg-muted/40 hover:bg-muted/60 rounded-xl transition-colors text-sm font-medium"
              >
                Add
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              General Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any important information about this student..."
              rows={4}
              className="w-full px-4 py-3 bg-input-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm"
            />
          </div>

          {/* Active Status */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary/20"
              />
              <div>
                <span className="text-sm font-medium text-foreground">Active Student</span>
                <p className="text-xs text-muted-foreground">
                  Inactive students won't appear in the main list
                </p>
              </div>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-muted/40 hover:bg-muted/60 rounded-xl transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors text-sm font-medium shadow-sm"
          >
            Add Student
          </button>
        </div>
      </div>
    </div>
  );
}
