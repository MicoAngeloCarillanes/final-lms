import { useState } from 'react';
import { supabase } from '../../../../supabaseClient';

/**
 * useRolloverLogic
 *
 * Manages the execution of the term rollover process.
 * Utilizes a Supabase RPC to duplicate sections across terms safely.
 */
export function useRolloverLogic() {
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Executes the duplication of sections from source to target.
   *
   * @param sourceSyId - The UUID of the source school year.
   * @param sourceSem - The source semester name.
   * @param targetSyId - The UUID of the target school year.
   * @param targetSem - The target semester name.
   * @returns
   */
  async function executeRollover(
    sourceSyId: string,
    sourceSem: string,
    targetSyId: string,
    targetSem: string
  ) {
    setIsProcessing(true);

    // Calls the database function to handle the duplication of section records
    const { data, error } = await supabase.rpc("rollover_sections", {
      p_source_sy_id: sourceSyId,
      p_source_term: sourceSem,
      p_target_sy_id: targetSyId,
      p_target_term: targetSem
    });

    setIsProcessing(false);
    return { count: data || 0, error };
  }

  return {
    executeRollover,
    isProcessing
  };
}