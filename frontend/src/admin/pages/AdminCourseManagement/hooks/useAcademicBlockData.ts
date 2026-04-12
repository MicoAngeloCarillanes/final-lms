import { useEffect, useState } from 'react';
import { supabase } from '../../../../supabaseClient';

export function useAcademicBlockData(
  searchQuery: string, 
  filterProgram: string = "", 
  filterYear: string = "",
  sortField: string = "block_name",
  sortDir: "asc" | "desc" = "asc"
) {
  const [isLoading, setIsLoading] = useState(false);
  const [blocks, setBlocks] = useState<any[]>([]);

  async function fetchBlocks() {
    setIsLoading(true);
    
    let q = supabase
      .from("academic_blocks")
      .select(`
        *,
        program (name, code),
        students (count)
      `);

    // Applying Ordering (Fresh API Sort)
    if (sortField === 'program_code') {
      q = q.order('code', { foreignTable: 'program', ascending: sortDir === 'asc' });
    } else {
      q = q.order(sortField, { ascending: sortDir === 'asc' });
    }

    if (searchQuery) {
      q = q.ilike("block_name", `%${searchQuery}%`);
    }

    if (filterProgram) {
      q = q.eq("program_id", filterProgram);
    }
    
    if (filterYear) {
      q = q.eq("year_level", filterYear);
    }

    const { data, error } = await q;

    if (!error && data) {
      setBlocks(data.map(b => ({
        ...b,
        program_code: b.program?.code || "N/A",
        program_name: b.program?.name || "Unknown",
        assigned_count: b.students?.[0]?.count || 0,
        csvMatch: b.block_name 
      })));
    }
    
    setIsLoading(false);
  }

  async function saveBlock(block: any) {
    setIsLoading(true);
    const payload = {
      block_name: block.block_name,
      program_id: block.program_id ? Number(block.program_id) : null,
      year_level: block.year_level,
      capacity: block.capacity ? Number(block.capacity) : null 
    };

    let error;
    if (block.block_id) {
      const res = await supabase.from("academic_blocks").update(payload).eq("block_id", block.block_id);
      error = res.error;
    } else {
      const res = await supabase.from("academic_blocks").insert(payload);
      error = res.error;
    }

    if (!error) await fetchBlocks();
    setIsLoading(false);
    return { error };
  }

  async function deleteBlock(blockId: string) {
    setIsLoading(true);
    const { error } = await supabase.from("academic_blocks").delete().eq("block_id", blockId);
    if (!error) await fetchBlocks();
    setIsLoading(false);
    return { error };
  }

  async function bulkDeleteBlocks(ids: string[]) {
    setIsLoading(true);
    const { error } = await supabase.from("academic_blocks").delete().in("block_id", ids);
    if (!error) await fetchBlocks();
    setIsLoading(false);
    return { error };
  }

  async function fetchAllStudents() {
    const { data, error } = await supabase
      .from("students")
      .select("user_id, student_id, block_id, users!inner(full_name, email)");
    if (error) console.error("Error fetching students:", error);
    return (data || []).map((s: any) => ({
      user_id: s.user_id,
      student_id: s.student_id,
      block_id: s.block_id,
      full_name: s.users?.full_name,
      email: s.users?.email
    }));
  }

  async function fetchStudentsByBlock(blockId: string) {
    const { data, error } = await supabase
      .from("students")
      .select("user_id, student_id, users!inner(full_name, email)")
      .eq("block_id", blockId);
    return (data || []).map((s: any) => ({
      user_id: s.user_id,
      student_id: s.student_id,
      full_name: s.users?.full_name,
      email: s.users?.email
    }));
  }

  async function assignStudentsToBlock(blockId: string, studentUserIds: string[]) {
    setIsLoading(true);
    const { error } = await supabase
      .from("students")
      .update({ block_id: blockId })
      .in("user_id", studentUserIds);
    if (!error) await fetchBlocks();
    setIsLoading(false);
    return { error };
  }

  async function unassignStudents(studentUserIds: string[]) {
    setIsLoading(true);
    const { error } = await supabase
      .from("students")
      .update({ block_id: null })
      .in("user_id", studentUserIds);
    if (!error) await fetchBlocks();
    setIsLoading(false);
    return { error };
  }

  useEffect(() => {
    void fetchBlocks();
  }, [searchQuery, filterProgram, filterYear, sortField, sortDir]);

  return {
    blocks, bulkDeleteBlocks, deleteBlock, isLoading, refreshBlocks: fetchBlocks, 
    saveBlock, fetchAllStudents, fetchStudentsByBlock, assignStudentsToBlock, unassignStudents
  };
}