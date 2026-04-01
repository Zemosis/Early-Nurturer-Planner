import { useState } from "react";
import {
  Download,
  Edit3,
  Save,
  Calendar,
  CheckCircle2,
  Circle,
  Plus,
  ChevronDown,
  User,
  FileText,
} from "lucide-react";
import { Student } from "../../types/student";
import { WeekPlan } from "../../utils/mockData";
import { getInitials, formatAge, getAgeGroupColor } from "../../utils/studentData";

interface StudentProfileViewProps {
  student: Student;
  week: WeekPlan;
  onUpdate: (student: Student) => void;
}

export function StudentProfileView({ student, week, onUpdate }: StudentProfileViewProps) {
  const [editMode, setEditMode] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(week.domains));
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [generalNotes, setGeneralNotes] = useState("");

  const ageGroupColors = getAgeGroupColor(student.age.group);

  const developmentalChecklist = {
    "Physical Development": [
      "Demonstrates gross motor skills (walking, running, climbing)",
      "Shows fine motor control (grasping, manipulating objects)",
      "Exhibits hand-eye coordination",
      "Engages in active play and movement",
    ],
    "Cognitive Development": [
      "Shows curiosity and explores environment",
      "Demonstrates problem-solving skills",
      "Engages in cause-and-effect play",
      "Exhibits focus during activities",
    ],
    "Social-Emotional Development": [
      "Interacts with peers appropriately",
      "Shows emotional regulation",
      "Demonstrates attachment to caregivers",
      "Expresses feelings and needs",
    ],
    "Language Development": [
      "Responds to verbal cues and instructions",
      "Attempts verbal communication",
      "Understands simple requests",
      "Shows interest in books and stories",
    ],
    "Creative Expression": [
      "Engages in art and creative activities",
      "Shows imagination during play",
      "Explores sensory materials",
      "Participates in music and movement",
    ],
  };

  const toggleDomain = (domain: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domain)) {
      newExpanded.delete(domain);
    } else {
      newExpanded.add(domain);
    }
    setExpandedDomains(newExpanded);
  };

  const toggleChecklistItem = (item: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(item)) {
      newChecked.delete(item);
    } else {
      newChecked.add(item);
    }
    setCheckedItems(newChecked);
  };

  const handleExportPDF = () => {
    // Generate PDF with student documentation
    const pdfWindow = window.open('', '_blank');
    if (!pdfWindow) {
      alert('Please allow pop-ups to export PDF.');
      return;
    }

    const pdfContent = `
<!DOCTYPE html>
<html>
<head>
  <title>${student.name} - Week ${week.weekNumber} Documentation</title>
  <style>
    @media print {
      @page { margin: 1in; }
    }
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 3px solid #387F39;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 { color: #387F39; margin: 0 0 10px 0; }
    .meta { color: #666; font-size: 14px; }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section-title {
      background: #F6E96B;
      padding: 10px 15px;
      font-weight: bold;
      margin-bottom: 15px;
      border-radius: 8px;
    }
    .checklist-item {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .checked { color: #387F39; }
    .observation {
      background: #f9f9f9;
      padding: 15px;
      border-left: 4px solid #387F39;
      margin-top: 10px;
      border-radius: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${student.name} - Weekly Documentation</h1>
    <div class="meta">
      <strong>Week ${week.weekNumber}:</strong> ${week.weekRange}<br>
      <strong>Theme:</strong> ${week.themeEmoji} ${week.theme}<br>
      <strong>Age:</strong> ${formatAge(student.age.months)} (${student.age.group})<br>
      <strong>Date Generated:</strong> ${new Date().toLocaleDateString()}
    </div>
  </div>

  ${Object.entries(developmentalChecklist).map(([domain, items]) => `
    <div class="section">
      <div class="section-title">${domain}</div>
      ${items.map(item => `
        <div class="checklist-item">
          <span class="${checkedItems.has(`${domain}-${item}`) ? 'checked' : ''}">
            ${checkedItems.has(`${domain}-${item}`) ? '✓' : '○'} ${item}
          </span>
        </div>
      `).join('')}
      ${observations[domain] ? `
        <div class="observation">
          <strong>Observations:</strong><br>
          ${observations[domain]}
        </div>
      ` : ''}
    </div>
  `).join('')}

  ${generalNotes ? `
    <div class="section">
      <div class="section-title">General Weekly Notes</div>
      <div class="observation">
        ${generalNotes}
      </div>
    </div>
  ` : ''}

  <div class="footer">
    <p>Generated by Early Nurturer Planner • Sarah's Family Daycare</p>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>`;

    pdfWindow.document.write(pdfContent);
    pdfWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Student Header Card */}
      <div className="bg-white rounded-2xl border-2 border-border p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0 text-2xl font-bold text-primary">
            {student.photo ? (
              <img
                src={student.photo}
                alt={student.name}
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              getInitials(student.name)
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-1">
                  {student.name}
                </h2>
                <p className="text-muted-foreground">{formatAge(student.age.months)} old</p>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium border ${ageGroupColors.bg} ${ageGroupColors.text} ${ageGroupColors.border}`}
              >
                {student.age.group}
              </span>
            </div>

            {/* Tags */}
            {student.tags && student.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {student.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-muted/50 text-muted-foreground text-xs rounded-lg"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Notes */}
            {student.notes && (
              <div className="bg-muted/20 rounded-xl p-4 border border-border">
                <p className="text-sm text-foreground leading-relaxed">{student.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex lg:flex-col gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Week Context */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Documenting for</p>
            <p className="font-medium text-foreground">
              Week {week.weekNumber}: {week.themeEmoji} {week.theme} ({week.weekRange})
            </p>
          </div>
        </div>
      </div>

      {/* Developmental Observations */}
      <div className="bg-white rounded-2xl border-2 border-border overflow-hidden">
        <div className="bg-primary/5 px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Developmental Observations & Checklist
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Track progress across all developmental domains
          </p>
        </div>

        <div className="p-6 space-y-4">
          {Object.entries(developmentalChecklist).map(([domain, items]) => {
            const isExpanded = expandedDomains.has(domain);
            const checkedCount = items.filter((item) =>
              checkedItems.has(`${domain}-${item}`)
            ).length;

            return (
              <div key={domain} className="border border-border rounded-xl overflow-hidden">
                {/* Domain Header */}
                <button
                  onClick={() => toggleDomain(domain)}
                  className="w-full flex items-center justify-between p-4 bg-muted/10 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform ${
                        isExpanded ? "" : "-rotate-90"
                      }`}
                    />
                    <h4 className="font-medium text-foreground">{domain}</h4>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {checkedCount} / {items.length}
                  </span>
                </button>

                {/* Domain Content */}
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {/* Checklist */}
                    <div className="space-y-2">
                      {items.map((item) => {
                        const itemKey = `${domain}-${item}`;
                        const isChecked = checkedItems.has(itemKey);

                        return (
                          <label
                            key={item}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/10 cursor-pointer transition-colors group"
                          >
                            <button
                              type="button"
                              onClick={() => toggleChecklistItem(itemKey)}
                              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isChecked
                                  ? "bg-primary border-primary"
                                  : "border-border group-hover:border-primary/50"
                              }`}
                            >
                              {isChecked && (
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              )}
                            </button>
                            <span
                              className={`text-sm flex-1 ${
                                isChecked
                                  ? "text-foreground font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {item}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Observation Notes */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Detailed Observations
                      </label>
                      <textarea
                        value={observations[domain] || ""}
                        onChange={(e) =>
                          setObservations({ ...observations, [domain]: e.target.value })
                        }
                        placeholder={`Record specific observations about ${domain.toLowerCase()}...`}
                        rows={3}
                        className="w-full px-4 py-3 bg-input-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* General Weekly Notes */}
      <div className="bg-white rounded-2xl border-2 border-border p-6">
        <h3 className="font-semibold text-foreground mb-4">General Weekly Notes</h3>
        <textarea
          value={generalNotes}
          onChange={(e) => setGeneralNotes(e.target.value)}
          placeholder="Additional observations, highlights, parent communications, or notable moments..."
          rows={5}
          className="w-full px-4 py-3 bg-input-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleExportPDF}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm font-medium"
        >
          <Download className="w-5 h-5" />
          Export This Week's Documentation
        </button>
      </div>
    </div>
  );
}
