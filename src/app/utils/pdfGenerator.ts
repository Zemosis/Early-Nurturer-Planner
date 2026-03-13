/**
 * PDF Generator Utility
 * Generates professional curriculum PDFs from week data
 */

import jsPDF from 'jspdf';
import { WeekPlan } from './mockData';

export interface PDFMetadata {
  version: string;
  generatedDate: string;
  weekDates: string;
}

export function generateCurriculumPDF(week: WeekPlan, metadata: PDFMetadata): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // Helper functions
  const addNewPage = () => {
    pdf.addPage();
    return margin; // Reset Y position
  };

  const drawHeader = (title: string, y: number, color: string = '#387F39') => {
    pdf.setFillColor(color);
    pdf.rect(margin, y, contentWidth, 12, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin + 5, y + 8);
    return y + 12;
  };

  const drawSubheader = (text: string, y: number) => {
    pdf.setTextColor(56, 127, 57); // Primary green
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(text, margin, y);
    return y + 6;
  };

  const drawBodyText = (text: string, y: number, maxWidth: number = contentWidth) => {
    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, margin, y);
    return y + (lines.length * 5);
  };

  const drawBulletPoint = (text: string, y: number) => {
    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.circle(margin + 2, y - 1.5, 1, 'F');
    const lines = pdf.splitTextToSize(text, contentWidth - 8);
    pdf.text(lines, margin + 6, y);
    return y + (lines.length * 4.5);
  };

  // Cover Page
  let y = 80;
  
  // Title
  pdf.setFillColor(246, 233, 107); // Highlight color
  pdf.rect(0, y - 10, pageWidth, 40, 'F');
  pdf.setTextColor(56, 127, 57);
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.text(week.theme.toUpperCase(), pageWidth / 2, y + 5, { align: 'center' });
  
  y += 20;
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Weekly Curriculum Plan', pageWidth / 2, y, { align: 'center' });
  
  y += 40;
  pdf.setTextColor(80, 80, 80);
  pdf.setFontSize(11);
  pdf.text(`Week ${week.weekNumber} • ${metadata.weekDates}`, pageWidth / 2, y, { align: 'center' });
  
  y += 8;
  pdf.text('Age Group: 0–3 Years (Mixed Age)', pageWidth / 2, y, { align: 'center' });
  
  y += 30;
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  pdf.text('Early Nurturer Planner', pageWidth / 2, y, { align: 'center' });
  pdf.text(`Version ${metadata.version} • Generated ${metadata.generatedDate}`, pageWidth / 2, y + 5, { align: 'center' });

  // Page 1: Weekly Theme Overview
  y = addNewPage();
  y = drawHeader('Weekly Theme Overview', y);
  y += 10;
  
  y = drawSubheader('Theme Focus', y);
  y = drawBodyText(`This week we explore "${week.theme}" across multiple developmental domains.`, y);
  y += 8;
  
  y = drawSubheader('Developmental Domains', y);
  week.objectives.slice(0, 3).forEach((obj: { domain: string; goal: string }) => {
    y = drawBulletPoint(`${obj.domain}: ${obj.goal}`, y);
  });
  y += 8;
  
  y = drawSubheader('Learning Goals', y);
  const goals = [
    'Engage children in theme-based exploration',
    'Support development across multiple domains',
    'Provide age-appropriate adaptations for 0-3 years',
    'Encourage hands-on, sensory-rich experiences'
  ];
  goals.forEach(goal => {
    y = drawBulletPoint(goal, y);
  });

  // Pages 2-3: Daily Activities
  y = addNewPage();
  y = drawHeader('Daily Activities Schedule', y);
  y += 10;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  week.activities.slice(0, 5).forEach((activity, index) => {
    if (y > pageHeight - 60) {
      y = addNewPage();
    }

    y = drawSubheader(`${days[index]} – ${activity.title}`, y);
    y = drawBodyText(activity.description, y);
    y += 5;
    
    // Age adaptations
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 100, 100);
    pdf.text('Age Adaptations:', margin, y);
    y += 4;
    
    pdf.setFont('helvetica', 'normal');
    const adaptations = (activity.adaptations ?? []).map(
      (a: { age: string; content: string }) => `${a.age}: ${a.content}`
    );
    adaptations.forEach(adapt => {
      const lines = pdf.splitTextToSize(adapt, contentWidth - 10);
      pdf.text(lines, margin + 5, y);
      y += lines.length * 3.5;
    });
    y += 8;
  });

  // Page 4: Circle Time Overview
  y = addNewPage();
  y = drawHeader('Circle Time Overview', y);
  y += 10;
  
  y = drawSubheader('Daily Learning Elements', y);
  y = drawBulletPoint(`Letter of the Week: ${week.circleTime.letter}`, y);
  y = drawBulletPoint(`Color Focus: ${week.circleTime.color}`, y);
  y = drawBulletPoint(`Shape: ${week.circleTime.shape}`, y);
  y = drawBulletPoint(`Counting to: ${week.circleTime.countingTo}`, y);
  y += 8;
  
  y = drawSubheader('Songs & Music', y);
  y = drawBulletPoint(`Greeting: ${week.circleTime.greetingSong.title}`, y);
  y = drawBulletPoint(`Goodbye: ${week.circleTime.goodbyeSong.title}`, y);
  y += 8;
  
  y = drawSubheader('🧘 Yoga & Mindful Movement', y);
  week.circleTime.yogaPoses.slice(0, 3).forEach(pose => {
    const summary = pose.howTo?.length ? pose.howTo[0] : '';
    y = drawBulletPoint(`${pose.name}${summary ? ': ' + summary : ''}`, y);
  });
  y += 8;
  
  y = drawSubheader('🎵 Music & Movement Activities', y);
  week.circleTime.musicMovementVideos.slice(0, 3).forEach(video => {
    y = drawBulletPoint(`${video.title} (${video.energyLevel} Energy)`, y);
  });

  // Page 5: Materials List
  y = addNewPage();
  y = drawHeader('Materials & Supplies Checklist', y);
  y += 10;
  
  const allMaterials = new Set<string>();
  week.activities.forEach(activity => {
    activity.materials.forEach(material => allMaterials.add(material));
  });
  
  y = drawSubheader('Required Materials', y);
  Array.from(allMaterials).slice(0, 25).forEach(material => {
    if (y > pageHeight - 20) {
      y = addNewPage();
    }
    pdf.setFontSize(9);
    pdf.rect(margin, y - 3, 3, 3);
    pdf.text(material, margin + 6, y);
    y += 6;
  });

  // Page 6: Parent Newsletter Summary
  y = addNewPage();
  y = drawHeader('Parent Newsletter Summary', y);
  y += 10;
  
  y = drawSubheader('This Week in Class', y);
  y = drawBodyText(`This week we're exploring the theme "${week.theme}". Children will engage in hands-on, sensory-rich activities across multiple developmental domains.`, y);
  y += 8;
  
  y = drawSubheader('Activities to Try at Home', y);
  const homeActivities = week.activities.slice(0, 3).map(a => a.title);
  homeActivities.forEach(activity => {
    y = drawBulletPoint(activity, y);
  });
  y += 8;
  
  y = drawSubheader('Questions to Ask Your Child', y);
  const questions = [
    `What did you learn about ${week.theme.toLowerCase()}?`,
    'What was your favorite activity this week?',
    'Can you show me the yoga poses we learned?',
    `What color/shape did we focus on?`
  ];
  questions.forEach(question => {
    y = drawBulletPoint(question, y);
  });

  // Page 7: Documentation Checklist
  y = addNewPage();
  y = drawHeader('Documentation & Observation Checklist', y);
  y += 10;
  
  y = drawSubheader('Developmental Observations', y);
  const observations = [
    'Physical development (gross & fine motor)',
    'Cognitive growth (problem-solving, exploration)',
    'Language development (communication, vocabulary)',
    'Social-emotional skills (interaction, regulation)',
    'Creative expression (art, music, movement)',
    'Self-help skills (independence, routines)'
  ];
  observations.forEach(obs => {
    pdf.setFontSize(9);
    pdf.rect(margin, y - 3, 3, 3);
    pdf.text(obs, margin + 6, y);
    y += 6;
  });
  
  y += 8;
  y = drawSubheader('Photo Documentation', y);
  const photoTasks = [
    'Individual child engagement',
    'Group activities',
    'Completed art projects',
    'Circle time participation',
    'Outdoor exploration',
    'Special moments'
  ];
  photoTasks.forEach(task => {
    pdf.setFontSize(9);
    pdf.rect(margin, y - 3, 3, 3);
    pdf.text(task, margin + 6, y);
    y += 6;
  });

  // Footer on all pages except cover
  const totalPages = pdf.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `${week.theme} • Week ${week.weekNumber}`,
      margin,
      pageHeight - 10
    );
    pdf.text(
      `Page ${i - 1} of ${totalPages - 1}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  return pdf;
}

export function downloadPDF(pdf: jsPDF, filename: string) {
  pdf.save(filename);
}

export function getPDFBlob(pdf: jsPDF): Blob {
  return pdf.output('blob');
}

export function getPDFDataURL(pdf: jsPDF): string {
  return pdf.output('dataurlstring');
}
