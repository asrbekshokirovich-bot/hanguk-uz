import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@/lib/i18n';
import { TaskList } from '../TaskList';
import { TaskKanbanBoard } from '../TaskKanbanBoard';
import { TaskDetailSheet } from '../TaskDetailSheet';
import type { Task } from '@/hooks/useTasks';

const base: Omit<Task, 'id' | 'status' | 'priority' | 'due_date'> = {
  title: 'Sample task',
  description: 'A description',
  assigned_to: 'u1',
  created_by: 'u1',
  student_id: 's1',
  application_id: null,
  completed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  source: 'manual',
  assignee: { full_name: 'Akmal Olimov' },
  creator: { full_name: 'Dilshod Rashidov' },
};

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

const tasks: Task[] = [
  { ...base, id: 't1', title: 'Overdue call', status: 'in_progress', priority: 'urgent', due_date: day(-2) },
  { ...base, id: 't2', title: 'Today submit', status: 'todo', priority: 'high', due_date: day(0) },
  { ...base, id: 't3', title: 'Upcoming review', status: 'todo', priority: 'normal', due_date: day(3), student_id: null },
  { ...base, id: 't4', title: 'Done pack', status: 'completed', priority: 'low', due_date: day(-3) },
];

const noop = () => {};
const studentMap = new Map([['s1', 'Aziz Karimov']]);
const commentCounts = new Map([['t1', 3]]);

describe('Tasks redesign smoke', () => {
  it('renders the Focus view with time buckets', () => {
    const { container, getByText, getAllByText } = render(
      <TaskList
        tasks={tasks}
        loading={false}
        studentMap={studentMap}
        commentCounts={commentCounts}
        onTaskClick={noop}
        onStatusChange={noop}
        onDelete={noop}
      />,
    );
    expect(getByText('Overdue call')).toBeTruthy();
    expect(getByText('Today submit')).toBeTruthy();
    expect(getAllByText('Aziz Karimov').length).toBeGreaterThan(0);
    expect(container).toBeTruthy();
  });

  it('renders the Focus empty state', () => {
    const { getByText } = render(
      <TaskList tasks={[]} loading={false} onTaskClick={noop} onStatusChange={noop} onDelete={noop} />,
    );
    expect(getByText('No tasks yet')).toBeTruthy();
  });

  it('renders the Board view with 3 columns', () => {
    const { getByText } = render(
      <TaskKanbanBoard
        tasks={tasks}
        studentMap={studentMap}
        commentCounts={commentCounts}
        onTaskClick={noop}
        onStatusChange={noop}
        onDelete={noop}
        onAddTask={noop}
      />,
    );
    expect(getByText('Upcoming review')).toBeTruthy();
  });

  it('renders the detail drawer with properties + comments', () => {
    const { getByText } = render(
      <TaskDetailSheet
        task={tasks[0]}
        open
        onOpenChange={noop}
        comments={[]}
        loadingComments={false}
        studentName="Aziz Karimov"
        onEdit={noop}
        onDelete={noop}
        onStatusChange={noop}
        onAddComment={async () => {}}
        onOpenStudent={noop}
      />,
    );
    expect(getByText('Linked student')).toBeTruthy();
    expect(getByText('No comments yet')).toBeTruthy();
  });
});
