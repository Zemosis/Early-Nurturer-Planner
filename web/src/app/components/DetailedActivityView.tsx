/**
 * DetailedActivityView - Comprehensive activity template with all sections
 * Mobile: Collapsible accordions
 * Desktop: Two-column layout
 */

import { useState } from 'react';
import { 
  Clock, 
  Target, 
  Package, 
  ListOrdered, 
  Users, 
  Lightbulb, 
  Eye, 
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Printer,
  CheckSquare,
  Info,
  Calendar,
  Tag,
} from 'lucide-react';
import { DetailedActivity, ageGroupConfig, domainConfig } from 'shared';

interface DetailedActivityViewProps {
  activity: DetailedActivity;
  themeName: string;
  themeColor: string;
}

type SectionId = 'objectives' | 'materials' | 'instructions' | 'adaptations' | 'differentiation' | 'observation' | 'reflection';

export function DetailedActivityView({ activity, themeName, themeColor }: DetailedActivityViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['objectives', 'instructions']));
  const [expandedAgeGroups, setExpandedAgeGroups] = useState<Set<string>>(new Set());
  const [checkedMaterials, setCheckedMaterials] = useState<Set<number>>(new Set());
  const [observationNotes, setObservationNotes] = useState('');
  const [reflectionNotes, setReflectionNotes] = useState('');

  const toggleSection = (section: SectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const toggleAgeGroup = (ageGroup: string) => {
    setExpandedAgeGroups(prev => {
      const next = new Set(prev);
      if (next.has(ageGroup)) {
        next.delete(ageGroup);
      } else {
        next.add(ageGroup);
      }
      return next;
    });
  };

  const toggleMaterial = (index: number) => {
    setCheckedMaterials(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const primaryDomain = activity.domains[0];
  const domainStyle = domainConfig[primaryDomain] || { color: themeColor, icon: '🎯' };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header - Mobile */}
      <div className="sticky top-0 z-10 bg-white border-b border-border shadow-sm lg:relative lg:shadow-none lg:border-0">
        <div className="px-4 py-4 lg:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{activity.day}</span>
                <span>•</span>
                <Clock className="w-3.5 h-3.5" />
                <span>{activity.timeBlock}</span>
                <span>•</span>
                <span>{activity.duration} min</span>
              </div>
              <h1 className="text-xl lg:text-2xl font-semibold text-foreground truncate">{activity.title}</h1>
            </div>
            <button className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition-colors">
              <Printer className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Domain Tags */}
          <div className="flex flex-wrap gap-2 mt-3">
            {activity.domains.map((domain, index) => (
              <span
                key={domain}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  index === 0 ? 'border-2' : ''
                }`}
                style={{
                  backgroundColor: domainConfig[domain]?.color + '15' || themeColor + '15',
                  color: domainConfig[domain]?.color || themeColor,
                  borderColor: domainConfig[domain]?.color || themeColor,
                }}
              >
                <span>{domainConfig[domain]?.icon || '🎯'}</span>
                {domain}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: Two-Column Layout */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:p-6">
        {/* LEFT COLUMN - Desktop */}
        <div className="space-y-4">
          {/* Overview Section */}
          <Section
            title="Activity Overview"
            icon={<Info className="w-5 h-5" />}
            defaultExpanded
          >
            <div className="space-y-4">
              {/* Theme Connection */}
              <div 
                className="p-4 rounded-xl border-l-4"
                style={{
                  backgroundColor: themeColor + '10',
                  borderLeftColor: themeColor,
                }}
              >
                <p className="text-sm font-medium text-muted-foreground mb-1">Theme Connection</p>
                <p className="text-sm text-foreground leading-relaxed">{activity.themeConnection}</p>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Duration</p>
                  <p className="text-sm font-medium text-foreground">{activity.duration} minutes</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Primary Domain</p>
                  <p className="text-sm font-medium text-foreground">{primaryDomain}</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Developmental Objectives */}
          <CollapsibleSection
            id="objectives"
            title="Developmental Objectives"
            icon={<Target className="w-5 h-5" />}
            expanded={expandedSections.has('objectives')}
            onToggle={() => toggleSection('objectives')}
          >
            <div className="space-y-4">
              {activity.objectives.map((objective, index) => (
                <div key={index} className="space-y-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: domainConfig[objective.domain]?.color || themeColor }}
                    />
                    {objective.domain}
                  </p>
                  <ul className="space-y-1.5 pl-4">
                    {objective.goals.map((goal, gIndex) => (
                      <li key={gIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckSquare className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Materials List */}
          <CollapsibleSection
            id="materials"
            title="Materials List"
            icon={<Package className="w-5 h-5" />}
            expanded={expandedSections.has('materials')}
            onToggle={() => toggleSection('materials')}
            badge={`${activity.materials.length} items`}
          >
            <div className="space-y-3">
              <div className="space-y-2">
                {activity.materials.map((material, index) => (
                  <label
                    key={index}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checkedMaterials.has(index)}
                      onChange={() => toggleMaterial(index)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm ${checkedMaterials.has(index) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {material.item}
                        </span>
                        {material.quantity && (
                          <span className="text-xs text-muted-foreground">({material.quantity})</span>
                        )}
                        {material.prepRequired && (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">Prep needed</span>
                        )}
                      </div>
                      {material.substitute && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Substitute: {material.substitute}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {activity.printMaterials && activity.printMaterials.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium">
                    <Printer className="w-4 h-4" />
                    Print Materials ({activity.printMaterials.length})
                  </button>
                </div>
              )}
            </div>
          </CollapsibleSection>
        </div>

        {/* RIGHT COLUMN - Desktop */}
        <div className="space-y-4">
          {/* Step-by-Step Instructions */}
          <CollapsibleSection
            id="instructions"
            title="Step-by-Step Instructions"
            icon={<ListOrdered className="w-5 h-5" />}
            expanded={expandedSections.has('instructions')}
            onToggle={() => toggleSection('instructions')}
            badge={`${activity.instructions.length} steps`}
          >
            <div className="space-y-3">
              {activity.instructions.map((instruction) => (
                <div
                  key={instruction.step}
                  className="flex gap-3 p-4 rounded-xl bg-muted/20 border border-border/50"
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    {instruction.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium text-foreground">{instruction.title}</h4>
                      {instruction.duration && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{instruction.duration}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{instruction.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Age-Level Adaptations */}
          <CollapsibleSection
            id="adaptations"
            title="Age-Level Adaptations"
            icon={<Users className="w-5 h-5" />}
            expanded={expandedSections.has('adaptations')}
            onToggle={() => toggleSection('adaptations')}
          >
            <div className="space-y-3">
              {activity.adaptations.map((adaptation) => {
                const config = ageGroupConfig[adaptation.ageGroup];
                const isExpanded = expandedAgeGroups.has(adaptation.ageGroup);

                return (
                  <div
                    key={adaptation.ageGroup}
                    className="border rounded-xl overflow-hidden"
                    style={{ borderColor: config.color }}
                  >
                    <button
                      onClick={() => toggleAgeGroup(adaptation.ageGroup)}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                      style={{ backgroundColor: config.bgColor }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{config.icon}</span>
                        <div className="text-left">
                          <p className="text-sm font-medium text-foreground">{config.label}</p>
                          {adaptation.duration && (
                            <p className="text-xs text-muted-foreground">{adaptation.duration}</p>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="p-4 bg-white space-y-3">
                        <p className="text-sm text-foreground leading-relaxed">{adaptation.description}</p>
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Key Modifications:</p>
                          <ul className="space-y-1">
                            {adaptation.modifications.map((mod, index) => (
                              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="mt-1.5" style={{ color: config.color }}>•</span>
                                <span>{mod}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Differentiation & Support */}
          <CollapsibleSection
            id="differentiation"
            title="Differentiation & Support"
            icon={<Lightbulb className="w-5 h-5" />}
            expanded={expandedSections.has('differentiation')}
            onToggle={() => toggleSection('differentiation')}
          >
            <div className="space-y-4">
              {activity.differentiation.map((strategy, index) => (
                <div key={index} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{strategy.title}</p>
                  <ul className="space-y-1.5 pl-4">
                    {strategy.strategies.map((item, sIndex) => (
                      <li key={sIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="mt-1.5" style={{ color: themeColor }}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Observation Prompts */}
          <CollapsibleSection
            id="observation"
            title="Observation Prompts"
            icon={<Eye className="w-5 h-5" />}
            expanded={expandedSections.has('observation')}
            onToggle={() => toggleSection('observation')}
            subtitle="Licensing-friendly documentation"
          >
            <div className="space-y-4">
              {activity.observationPrompts.map((prompt, index) => (
                <div key={index} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{prompt.category}</p>
                  <ul className="space-y-1.5 pl-4">
                    {prompt.prompts.map((item, pIndex) => (
                      <li key={pIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckSquare className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              
              <div className="pt-3 border-t border-border">
                <label className="block">
                  <span className="text-sm font-medium text-foreground mb-2 block">Observation Notes</span>
                  <textarea
                    value={observationNotes}
                    onChange={(e) => setObservationNotes(e.target.value)}
                    rows={4}
                    placeholder="Record what you observed during this activity..."
                    className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-sm"
                  />
                </label>
              </div>
            </div>
          </CollapsibleSection>

          {/* Teacher Reflection */}
          <CollapsibleSection
            id="reflection"
            title="Teacher Reflection"
            icon={<MessageSquare className="w-5 h-5" />}
            expanded={expandedSections.has('reflection')}
            onToggle={() => toggleSection('reflection')}
            subtitle="Optional - for your growth"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                {activity.reflectionPrompts.map((prompt, index) => (
                  <p key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="mt-1" style={{ color: themeColor }}>•</span>
                    <span>{prompt}</span>
                  </p>
                ))}
              </div>

              <div className="pt-3 border-t border-border">
                <label className="block">
                  <span className="text-sm font-medium text-foreground mb-2 block">Your Reflections</span>
                  <textarea
                    value={reflectionNotes}
                    onChange={(e) => setReflectionNotes(e.target.value)}
                    rows={5}
                    placeholder="What worked well? What would you adjust next time?"
                    className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-sm"
                  />
                </label>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}

// Reusable Section Components
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function Section({ title, icon, children, defaultExpanded = true }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-primary">{icon}</div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

interface CollapsibleSectionProps {
  id: SectionId;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  subtitle?: string;
}

function CollapsibleSection({ title, icon, children, expanded, onToggle, badge, subtitle }: CollapsibleSectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="text-primary">{icon}</div>
          <div className="text-left">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {badge && (
            <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
              {badge}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}
