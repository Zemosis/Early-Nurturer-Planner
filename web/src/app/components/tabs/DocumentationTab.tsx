import { useState } from "react";
import { 
  UserPlus, 
  Search, 
  Filter, 
  ChevronLeft, 
  Download, 
  Edit3,
  Calendar,
  Eye,
  X
} from "lucide-react";
import { WeekPlan } from "../../utils/mockData";
import { Student } from "../../types/student";
import { 
  mockStudents, 
  getInitials, 
  getAgeGroupColor, 
  formatAge,
  calculateAge 
} from "../../utils/studentData";
import { AddStudentModal } from "../modals/AddStudentModal";
import { StudentProfileView } from "../student/StudentProfileView";

interface DocumentationTabProps {
  week: WeekPlan;
}

type ViewMode = 'grid' | 'student-profile';

export function DocumentationTab({ week }: DocumentationTabProps) {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Filter students
  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = showActiveOnly ? student.isActive : true;
    return matchesSearch && matchesActive;
  });

  const handleAddStudent = (studentData: Omit<Student, 'id' | 'createdAt' | 'age'>) => {
    const age = calculateAge(studentData.birthdate);
    const newStudent: Student = {
      ...studentData,
      id: Date.now().toString(),
      age,
      createdAt: new Date().toISOString(),
    };
    setStudents([...students, newStudent]);
    setShowAddModal(false);
  };

  const handleOpenProfile = (student: Student) => {
    setSelectedStudent(student);
    setViewMode('student-profile');
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
    setSelectedStudent(null);
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    setStudents(students.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    setSelectedStudent(updatedStudent);
  };

  return (
    <div className="space-y-6">
      {/* Grid View: Student Cards */}
      {viewMode === 'grid' && (
        <>
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Student Documentation</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} • Week {week.weekNumber}
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Student</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search students by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              />
            </div>
            <button
              onClick={() => setShowActiveOnly(!showActiveOnly)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors text-sm font-medium ${
                showActiveOnly
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-white border-border text-foreground hover:bg-muted/10'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Active Only</span>
            </button>
          </div>

          {/* Student Cards Grid */}
          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-border p-12 text-center">
              <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No Students Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Get started by adding your first student'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  <UserPlus className="w-4 h-4" />
                  Add First Student
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStudents.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onOpen={() => handleOpenProfile(student)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Student Profile View */}
      {viewMode === 'student-profile' && selectedStudent && (
        <div>
          {/* Back Button */}
          <button
            onClick={handleBackToGrid}
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-4 group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Back to Students</span>
          </button>

          {/* Student Profile */}
          <StudentProfileView
            student={selectedStudent}
            week={week}
            onUpdate={handleUpdateStudent}
          />
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddStudent}
        />
      )}
    </div>
  );
}

// Student Card Component
interface StudentCardProps {
  student: Student;
  onOpen: () => void;
}

function StudentCard({ student, onOpen }: StudentCardProps) {
  const ageGroupColors = getAgeGroupColor(student.age.group);

  return (
    <button
      onClick={onOpen}
      className="bg-white rounded-2xl border-2 border-border p-5 hover:shadow-lg hover:border-primary/30 transition-all text-left group"
    >
      {/* Avatar & Status */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0 text-lg font-semibold text-primary group-hover:scale-105 transition-transform">
          {student.photo ? (
            <img
              src={student.photo}
              alt={student.name}
              className="w-full h-full rounded-xl object-cover"
            />
          ) : (
            getInitials(student.name)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {student.name}
          </h3>
          <p className="text-sm text-muted-foreground">{formatAge(student.age.months)}</p>
        </div>
      </div>

      {/* Age Group Badge */}
      <div className="mb-3">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${ageGroupColors.bg} ${ageGroupColors.text} ${ageGroupColors.border}`}
        >
          {student.age.group}
        </span>
      </div>

      {/* Tags */}
      {student.tags && student.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {student.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-muted/50 text-muted-foreground text-xs rounded-md"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Notes Preview */}
      {student.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{student.notes}</p>
      )}

      {/* View Button */}
      <div className="flex items-center justify-between text-primary text-sm font-medium pt-3 border-t border-border">
        <span className="group-hover:gap-2 transition-all flex items-center gap-1">
          <Eye className="w-4 h-4" />
          View Profile
        </span>
        <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </button>
  );
}
