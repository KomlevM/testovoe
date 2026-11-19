// normalizers/task-view.normalizer.ts

import {
    DtoDate, PriorityValue, STATUS_LABELS, STATUS_TONES, StatusTone, StatusValue,
    TaskDto, TaskView, Urgency,
} from '../models/task.models';

export const DUE_FAR_FUTURE_DAYS = 365;

/** ISO-8601 UTC из *UTC-поля → Date | null. Никакой регуляторки под dd.mm.yyyy. */
export function toUtcDate(raw: string | null | undefined): Date | null {
    if (!raw || raw === 'Неизвестно') return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

function statusLabel(s: StatusValue): string {
    if (s === null) return '—';
    if (s === 'Неизвестно') return 'Неизвестно';
    return STATUS_LABELS[s];
}

function statusTone(s: StatusValue): StatusTone {
    if (s === null || s === 'Неизвестно') return 'neutral';
    return STATUS_TONES[s];
}

function priorityLabel(p: PriorityValue): string {
    return p === null ? '—' : p;
}

export function toTaskView(dto: TaskDto, now: Date): TaskView {
    const createdUtc = toUtcDate(dto.createdUTC);
    const dueUtc = toUtcDate(dto.dueUTC);
    const updatedUtc = toUtcDate(dto.updatedUTC);
    const completedUtc = toUtcDate(dto.completedUTC);

    const dueBeforeCreated =
        createdUtc !== null && dueUtc !== null && dueUtc.getTime() < createdUtc.getTime();

    const dueFarFuture =
        dueUtc !== null && dueUtc.getTime() - now.getTime() > DUE_FAR_FUTURE_DAYS * 86_400_000;

    return {
        id: dto.id,
        key: dto.key,
        source: dto.source,

        title: dto.title?.trim() ?? '',
        description: dto.description?.trim() ?? '',

        status: dto.status,
        statusLabel: statusLabel(dto.status),
        statusTone: statusTone(dto.status),

        priority: dto.priority,
        priorityLabel: priorityLabel(dto.priority),

        project: dto.project,
        assignee: dto.assignee,
        assignee_active: dto.assignee_active,

        archived: dto.archived,

        created: dto.created,
        due: dto.due,
        updated: dto.updated,
        completed: dto.completed,

        createdUtc, dueUtc, updatedUtc, completedUtc,

        estimate: typeof dto.estimate === 'number' ? dto.estimate : null,
        tags: dto.tags ?? [],
        comments: dto.comments ?? [],

        dueBeforeCreated,
        dueFarFuture,

        all_data: dto.all_data
    };
}

export function computeUrgency(dueUtc: Date | null, now: Date, soonDays: number): Urgency {
    if (!dueUtc) return 'no-due';
    const diff = dueUtc.getTime() - now.getTime();
    if (diff < 0) return 'overdue';
    if (diff <= soonDays * 86_400_000) return 'soon';
    return 'ok';
}