import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../supabaseClient';

interface SortState {
    field: string;
    dir: 'asc' | 'desc';
}

/**
 * useFacilitiesData
 *
 * Manages campus rooms and structured schedule blocks.
 * Normalizes database records to ensure unique 'id' fields for grid rendering.
 */
export default function useFacilitiesData(
    roomSort: SortState = { field: 'room_name', dir: 'asc' },
    schedSort: SortState = { field: 'schedule_label', dir: 'asc' }
) {
    const [isLoading, setIsLoading] = useState(false);
    const [rooms, setRooms] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);

    /**
     * fetchRooms
     * Fetches and maps room_id to a standard id field.
     */
    const fetchRooms = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from("rooms")
            .select("*")
            .order(roomSort.field, { ascending: roomSort.dir === 'asc' });
        
        if (!error && data) {
            setRooms(data.map(r => ({ ...r, id: r.room_id })));
        }
        setIsLoading(false);
    }, [roomSort]);

    /**
     * fetchSchedules
     * Fetches and maps schedule_id to a standard id field.
     */
    const fetchSchedules = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from("schedules")
            .select("*")
            .order(schedSort.field, { ascending: schedSort.dir === 'asc' });
        
        if (!error && data) {
            setSchedules(data.map(s => ({ ...s, id: s.schedule_id })));
        }
        setIsLoading(false);
    }, [schedSort]);

    const fetchData = useCallback(async () => {
        await Promise.all([fetchRooms(), fetchSchedules()]);
    }, [fetchRooms, fetchSchedules]);

    async function addRoom(name: string, capacity: number) {
        setIsLoading(true);
        const { error } = await supabase.from("rooms").insert({ room_name: name, capacity });
        if (!error) await fetchRooms();
        setIsLoading(false);
        return { error };
    }

    async function bulkAddRooms(payload: any[]) {
        setIsLoading(true);
        const { error } = await supabase.from("rooms").insert(payload);
        if (!error) await fetchRooms();
        setIsLoading(false);
        return { error };
    }

    async function deleteRooms(ids: string[]) {
        setIsLoading(true);
        const { error } = await supabase.from("rooms").delete().in("room_id", ids);
        if (!error) await fetchRooms();
        setIsLoading(false);
        return { error };
    }

    async function addSchedule(payload: {
        label: string;
        days: string;
        startTime: string;
        endTime: string;
    }) {
        setIsLoading(true);
        const { error } = await supabase.from("schedules").insert({ 
            schedule_label: payload.label,
            day_pattern: payload.days,
            time_start: payload.startTime,
            time_end: payload.endTime
        });
        
        if (!error) await fetchSchedules();
        setIsLoading(false);
        return { error };
    }

    async function bulkAddSchedules(payload: any[]) {
        setIsLoading(true);
        const { error } = await supabase.from("schedules").insert(payload);
        if (!error) await fetchSchedules();
        setIsLoading(false);
        return { error };
    }

    async function deleteSchedules(ids: string[]) {
        setIsLoading(true);
        const { error } = await supabase.from("schedules").delete().in("schedule_id", ids);
        if (!error) await fetchSchedules();
        setIsLoading(false);
        return { error };
    }

    async function getUsage(type: 'room' | 'schedule', identifier: string) {
        const field = type === 'room' ? 'room_id' : 'schedule_label';
        const { data, error } = await supabase
            .from("course_sections")
            .select(`
                section_id,
                section_label,
                courses (course_code, course_name),
                academic_blocks (block_name)
            `)
            .eq(field, identifier);
        
        return { data, error };
    }

    useEffect(() => {
        void fetchRooms();
    }, [fetchRooms]);

    useEffect(() => {
        void fetchSchedules();
    }, [fetchSchedules]);

    return {
        addRoom,
        bulkAddRooms,
        addSchedule,
        bulkAddSchedules,
        deleteRooms,
        deleteSchedules,
        getUsage,
        isLoading,
        refresh: fetchData,
        rooms,
        schedules
    };
}