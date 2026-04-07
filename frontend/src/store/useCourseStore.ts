/**
 * useCourseStore
 *
 * Centralized state management for course operations, handling
 * capacity checks and academic completion statuses.
 *
 * @example
 * const { enrollStudent, updateCompletionStatus } = useCourseStore();
 */
import { create } from 'zustand';
import { supabase } from '../supabaseClient';

export interface CourseStoreState {
  // Indicates if a database operation is currently running
  isLoading: boolean;

  /**
   * Enrolls a student in a section, routing through the database capacity check.
   * @param studentId The UUID of the student.
   * @param courseId The UUID of the course.
   * @param sectionId The UUID of the target section.
   * @returns
   */
  enrollStudent: (studentId: string, courseId: string, sectionId: string) => Promise<'Enrolled' | 'Waitlisted' | null>;

  /**
   * Updates the final academic completion status of a student for a specific course.
   * @param studentId The UUID of the student.
   * @param courseId The UUID of the course.
   * @param status The final academic verdict.
   * @returns
   */
  updateCompletionStatus: (studentId: string, courseId: string, status: 'Ongoing' | 'Finished' | 'INC' | 'Failed') => Promise<boolean>;
}

export const useCourseStore = create<CourseStoreState>((set) => ({
  isLoading: false,

  enrollStudent: async (studentId, courseId, sectionId) => {
    set({ isLoading: true });

    const { data, error } = await supabase.rpc('enroll_student_with_capacity_check', {
      p_student_id: studentId,
      p_course_id: courseId,
      p_section_id: sectionId
    });

    set({ isLoading: false });

    if (error) {
      console.error(error);
      return null;
    }

    return data as 'Enrolled' | 'Waitlisted';
  },

  updateCompletionStatus: async (studentId, courseId, status) => {
    set({ isLoading: true });

    const { error } = await supabase
      .from('student_course_assignments')
      .update({ completion_status: status })
      .match({ student_id: studentId, course_id: courseId });

    set({ isLoading: false });

    if (error) {
      console.error(error);
      return false;
    }

    return true;
  }
}));